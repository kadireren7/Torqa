import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import { validatePolicyRules } from "@/lib/governance/policy-v2/validate";
import { VALID_SOURCES } from "@/lib/governance/policy-v2/types";
import {
  isReasonableSlug,
  rowToPolicyPackDto,
  VALID_VERDICTS_FOR_DTO,
} from "@/lib/governance/policy-v2/dto";
import { listBuiltInTemplateSlugs } from "@/lib/governance/policy-v2/resolver";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";

export const runtime = "nodejs";

const POLICY_PACK_BODY_MAX_BYTES = 256 * 1024;

const SELECT_COLS =
  "id, user_id, organization_id, name, slug, description, level, source_type, parent_pack_id, parent_template_slug, default_verdict, rules, enabled, created_at, updated_at";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const requestId = getOrCreateRequestId(request);
  const { id } = await context.params;
  if (!id) return jsonErrorResponse(400, "Pack id is required", requestId);

  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is not configured", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) return jsonErrorResponse(401, "Sign in required", requestId);

  const { data, error } = await supabase.from("policy_packs").select(SELECT_COLS).eq("id", id).maybeSingle();
  if (error) return jsonDatabaseErrorResponse(requestId);
  if (!data) return jsonErrorResponse(404, "Pack not found", requestId);

  return attachRequestIdHeader(
    NextResponse.json({ item: rowToPolicyPackDto(data as Record<string, unknown>) }),
    requestId
  );
}

export async function PUT(request: Request, context: RouteContext) {
  const requestId = getOrCreateRequestId(request);
  const { id } = await context.params;
  if (!id) return jsonErrorResponse(400, "Pack id is required", requestId);

  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) return jsonErrorResponse(401, "Sign in required", requestId);
  if (scope.organizationId && !scope.isAdmin) {
    return jsonErrorResponse(403, "Only owners or admins can update policy packs", requestId);
  }

  const { data: existing, error: existingErr } = await supabase
    .from("policy_packs")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (existingErr) return jsonDatabaseErrorResponse(requestId);
  if (!existing) return jsonErrorResponse(404, "Pack not found", requestId);

  const parsed = await readJsonBodyWithByteLimit(request, POLICY_PACK_BODY_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);
  const body = parsed.value;
  if (!isPlainObject(body)) return jsonErrorResponse(400, "Body must be a JSON object", requestId);

  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 200) {
      return jsonErrorResponse(400, "name must be 1..200 chars", requestId);
    }
    update.name = name;
  }

  if (typeof body.description === "string") {
    update.description = body.description.trim().slice(0, 2000);
  } else if (body.description === null) {
    update.description = null;
  }

  if (typeof body.slug === "string") {
    const slug = body.slug.trim();
    if (!isReasonableSlug(slug)) {
      return jsonErrorResponse(400, "slug must be 1..80 chars, lowercase letters/digits/hyphens", requestId);
    }
    update.slug = slug;
  }

  if (typeof body.defaultVerdict === "string") {
    if (!VALID_VERDICTS_FOR_DTO.includes(body.defaultVerdict as (typeof VALID_VERDICTS_FOR_DTO)[number])) {
      return jsonErrorResponse(
        400,
        `defaultVerdict must be one of ${VALID_VERDICTS_FOR_DTO.join(", ")}`,
        requestId
      );
    }
    update.default_verdict = body.defaultVerdict;
  }

  if (typeof body.enabled === "boolean") {
    update.enabled = body.enabled;
  }

  if (typeof body.parentPackId === "string" || body.parentPackId === null) {
    const parentId = typeof body.parentPackId === "string" && body.parentPackId.trim() ? body.parentPackId.trim() : null;
    if (parentId) {
      if (parentId === id) {
        return jsonErrorResponse(400, "A pack cannot inherit from itself", requestId);
      }
      const { data: parent } = await supabase
        .from("policy_packs")
        .select("id, organization_id, user_id")
        .eq("id", parentId)
        .maybeSingle();
      if (!parent) {
        return jsonErrorResponse(400, "parentPackId not visible in this scope", requestId);
      }
      const sameOrg = scope.organizationId
        ? parent.organization_id === scope.organizationId
        : parent.organization_id === null && parent.user_id === scope.userId;
      if (!sameOrg) {
        return jsonErrorResponse(400, "parentPackId must be in the same scope", requestId);
      }
    }
    update.parent_pack_id = parentId;
  }

  if (typeof body.parentTemplateSlug === "string" || body.parentTemplateSlug === null) {
    const slug = typeof body.parentTemplateSlug === "string" && body.parentTemplateSlug.trim() ? body.parentTemplateSlug.trim() : null;
    if (slug) {
      const builtIn = listBuiltInTemplateSlugs().includes(slug);
      if (!builtIn) {
        const { data: tpl } = await supabase
          .from("policy_templates")
          .select("slug")
          .eq("slug", slug)
          .maybeSingle();
        if (!tpl) return jsonErrorResponse(400, `Unknown parentTemplateSlug "${slug}"`, requestId);
      }
    }
    update.parent_template_slug = slug;
  }

  if (typeof body.level === "string") {
    if (body.level !== "workspace" && body.level !== "source") {
      return jsonErrorResponse(400, "level must be 'workspace' or 'source'", requestId);
    }
    update.level = body.level;
    if (body.level === "workspace") {
      update.source_type = null;
    } else if (typeof body.sourceType === "string") {
      if (!VALID_SOURCES.includes(body.sourceType as (typeof VALID_SOURCES)[number])) {
        return jsonErrorResponse(
          400,
          `sourceType must be one of ${VALID_SOURCES.join(", ")}`,
          requestId
        );
      }
      update.source_type = body.sourceType;
    }
  } else if (typeof body.sourceType === "string") {
    if (!VALID_SOURCES.includes(body.sourceType as (typeof VALID_SOURCES)[number])) {
      return jsonErrorResponse(
        400,
        `sourceType must be one of ${VALID_SOURCES.join(", ")}`,
        requestId
      );
    }
    update.source_type = body.sourceType;
  } else if (body.sourceType === null) {
    update.source_type = null;
  }

  let validationIssues: ReturnType<typeof validatePolicyRules>["issues"] = [];
  if (Array.isArray(body.rules)) {
    const validation = validatePolicyRules(body.rules);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Rules validation failed", code: "validation_error", issues: validation.issues, requestId },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }
    update.rules = validation.rules;
    validationIssues = validation.issues;
  }

  if (Object.keys(update).length === 0) {
    return jsonErrorResponse(400, "No updatable fields supplied", requestId);
  }

  const { data, error } = await supabase
    .from("policy_packs")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return jsonErrorResponse(409, "Slug already exists in this scope", requestId, "conflict");
    }
    return jsonDatabaseErrorResponse(requestId);
  }
  if (!data) return jsonErrorResponse(404, "Pack not found after update", requestId);

  return attachRequestIdHeader(
    NextResponse.json({
      item: rowToPolicyPackDto(data as Record<string, unknown>),
      validation: { issues: validationIssues },
    }),
    requestId
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getOrCreateRequestId(request);
  const { id } = await context.params;
  if (!id) return jsonErrorResponse(400, "Pack id is required", requestId);

  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) return jsonErrorResponse(401, "Sign in required", requestId);
  if (scope.organizationId && !scope.isAdmin) {
    return jsonErrorResponse(403, "Only owners or admins can delete policy packs", requestId);
  }

  const { error } = await supabase.from("policy_packs").delete().eq("id", id);
  if (error) return jsonDatabaseErrorResponse(requestId);

  return attachRequestIdHeader(NextResponse.json({ ok: true }), requestId);
}
