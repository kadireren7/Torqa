# Torqa cloud backend (Supabase)

This document describes the **first Torqa cloud** backend: relational schema, **row level security (RLS)**, and how a **dashboard / API** layer should sit on top of Supabase (PostgREST + Edge Functions).

Migrations live under [`supabase/migrations/`](../supabase/migrations/).

---

## Goals

| Goal | Approach |
| --- | --- |
| Multi-tenant teams | **Organizations** + **organization_members** with roles. |
| Scoped work | **Projects** under an org (specs, CI targets, environments). |
| Trust strictness | **`policies`** rows: built-in `trust_profile` + `fail_on_warning` + future `rules_overrides` JSON. |
| Audit / dashboard | **`validation_runs`** (immutable facts) + **`reports`** (normalized artifacts or Storage pointers). |
| Auth | **Supabase Auth** (`auth.users`); **`profiles`** extends identity for the app. |

---

## Entity model

```mermaid
erDiagram
  auth_users ||--|| profiles : id
  organizations ||--o{ organization_members : has
  profiles ||--o{ organization_members : joins
  organizations ||--o{ projects : contains
  organizations ||--o{ policies : defines
  projects ||--o{ policies : may_scope
  projects ||--o{ validation_runs : records
  policies ||--o{ validation_runs : uses
  validation_runs ||--o{ reports : materializes

  profiles {
    uuid id PK
    text display_name
  }
  organizations {
    uuid id PK
    citext slug
    text name
    uuid created_by FK
    timestamptz deleted_at
  }
  organization_members {
    uuid organization_id PK_FK
    uuid user_id PK_FK
    text role
  }
  projects {
    uuid id PK
    uuid organization_id FK
    text slug
    uuid default_policy_id FK
  }
  policies {
    uuid id PK
    uuid organization_id FK
    uuid project_id FK_null
    text trust_profile
    bool fail_on_warning
    jsonb rules_overrides
  }
  validation_runs {
    uuid id PK
    uuid project_id FK
    uuid policy_id FK_null
    text trust_profile
    text status
    jsonb result_json
  }
  reports {
    uuid id PK
    uuid validation_run_id FK
    text schema_kind
    jsonb payload
    text storage_object_path
  }
```

- **`policies.project_id`**: `NULL` = org-wide template; non-null = policy attached to that project.
- **`projects.default_policy_id`**: optional convenience pointer for the dashboard.
- **`validation_runs.result_json`**: optional full **`torqa.cli.scan.v1`** / **`torqa.cli.validate.v1`** payload; large runs should move bulk bytes to **Supabase Storage** and store only `summary` + `reports.storage_object_path`.

---

## SQL schema (summary)

| Table | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users`; display name / avatar. |
| `organizations` | Tenant; unique `slug`; soft-delete via `deleted_at`. |
| `organization_members` | Composite PK `(organization_id, user_id)`; role `owner \| admin \| member \| viewer`. |
| `projects` | Unique `(organization_id, slug)`; optional `archived_at`. |
| `policies` | Trust gate configuration for org or project; unique slug per scope (partial indexes). |
| `validation_runs` | One execution: `status`, `summary`, `result_json`, `exit_code`, `idempotency_key` (optional, unique per project). |
| `reports` | One row per artifact (`schema_kind`, `payload` or `storage_object_path`). |

RPC:

- **`create_organization(name, slug)`** — `SECURITY DEFINER`; creates org + owner membership in one transaction (preferred over ad-hoc REST for onboarding).

Triggers:

- **`on_auth_user_created`** — inserts `profiles` when a user signs up.

---

## Row level security (RLS)

RLS is enabled on all tenant tables. Helper functions ( **`SECURITY INVOKER`** ) derive access from **`auth.uid()`** and membership:

| Function | Meaning |
| --- | --- |
| `organization_role(org_id)` | Caller’s role in org, or `NULL`. |
| `is_org_member(org_id)` | Boolean membership. |
| `project_role(project_id)` | Role inherited via `projects.organization_id`. |
| `can_write_project(project_id)` | `owner`, `admin`, or `member`. |
| `can_admin_org(org_id)` | `owner` or `admin`. |

### Policy highlights

- **Profiles**: self read/update only.
- **Organizations**: members read active orgs; **creators** can read an org before the first membership row exists (bootstrap); admins update; inserts allowed for `created_by = auth.uid()`.
- **Organization members**: members read; **admins** invite/change roles; **bootstrap** allows the **first** `owner` row when `organizations.created_by = auth.uid()` and the org has no members yet (pairs with client-side org insert + member insert).
- **Projects**: any org member may **select** (including archived for audit); **insert** if org role is owner/admin/member; **update** if project role is owner/admin/member; **delete** if owner/admin on project.
- **Policies**: select with project scope rules; **archived** policies visible to **org admins** only; writes require org writer + project write when `project_id` is set.
- **Validation runs**: **select** if caller has any project role; **insert** if `can_write_project` and `created_by` is self or null. **No authenticated `UPDATE`** — workers flip `status` / `result_json` with the **service role** (Edge Function, background job).
- **Reports**: **select**/**insert** tied to parent run and project write access.

### Service role

**`service_role`** receives table grants for **Edge Functions** that enqueue runs, write results, and attach Storage paths without widening client RLS.

### Forks and elevated access

- Keep **destructive** operations (org delete, billing) behind **Edge Functions** + service role or **Stripe webhooks**, not anon keys.
- Prefer **`authenticated`** JWT for dashboard API; never ship **service_role** to browsers.

---

## API structure

### 1. PostgREST (auto REST)

Supabase exposes tables under `/rest/v1/…` with the user’s JWT. Typical patterns:

| Resource | Verb | Notes |
| --- | --- | --- |
| `/profiles` | `GET`, `PATCH` | Current user only (RLS). |
| `/organizations` | `GET`, `POST`, `PATCH` | Bootstrap org + member per RLS; or call RPC. |
| `/organization_members` | `GET`, `POST`, `PATCH`, `DELETE` | Invites / role changes. |
| `/projects` | CRUD | Scoped by org. |
| `/policies` | CRUD | Org or project scoped. |
| `/validation_runs` | `GET`, `POST` | Clients create **queued** rows; workers finalize with service role. |
| `/reports` | `GET`, `POST` | Attach JSON/HTML/MD rows or Storage metadata. |

**RPC** (PostgREST `/rest/v1/rpc/create_organization`):

```http
POST /rest/v1/rpc/create_organization
Content-Type: application/json
Authorization: Bearer <user_jwt>

{ "p_name": "Acme", "p_slug": "acme" }
```

### 2. Edge Functions (recommended boundaries)

Keep **Torqa execution** (calling Python CLI or a future WASM engine) off the hot path of direct table writes:

1. **`POST /functions/v1/enqueue-validation`** — Auth user JWT; validates org/project; inserts `validation_runs` (`status=queued`) with **service role** or definer RPC; returns `run_id`.
2. **`POST /functions/v1/complete-validation` (internal)** — Invoked by worker with **service key**; updates run `status`, `result_json`, `summary`, `exit_code`; inserts `reports` rows; optional Storage upload.

This scales to **queues** (Supabase Queues, PGMQ, or external workers) without giving clients `UPDATE` on `validation_runs`.

### 3. Realtime (optional)

Subscribe clients to **`validation_runs`** for live status when workers complete jobs:

```sql
-- After validating your project slug, enable in Dashboard or migration:
alter publication supabase_realtime add table public.validation_runs;
```

### 4. Storage (optional)

Bucket **`torqa-artifacts`** (private): paths like `{org_id}/{project_id}/{run_id}/report.json`. RLS on Storage should mirror **`can_write_project`** via custom Storage policies referencing JWT claims or a signed URL pattern from Edge Functions.

---

## Idempotency and scale

- **`validation_runs.idempotency_key`**: unique per `(project_id, idempotency_key)` when set — safe retries from GitHub Actions or CLI.
- **`result_json`**: cap size in app logic; spill to **`reports`** + Storage for large payloads.
- **Indexing**: see migration (`validation_runs (project_id, created_at desc)`, `organization_members (user_id)`, …).

---

## Next steps (product)

- **Invitations** table + email flow (or use Supabase invite APIs only for auth, keep org invite separate).
- **Audit log** table (append-only) fed from triggers on sensitive tables.
- **Usage metering** (`validation_runs` counts per org per billing period).
- **Edge runtime** packaging Torqa validate/scan for low-latency regions.

---

## Related docs

- Trust profiles (aligns with `policies.trust_profile`): [Trust profiles](trust-profiles.md)
- CI / JSON artifacts today: [GitHub Actions](github-actions.md), [CI reports](ci-report.md)
