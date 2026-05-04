import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import { validatePolicyRules } from "@/lib/governance/policy-v2/validate";
import {
  VALID_SOURCES,
  type PolicyPackLevel,
} from "@/lib/governance/policy-v2/types";
import {
  deriveSlug,
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return attachRequestIdHeader(NextResponse.json({ items: [] }), requestId);
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to list policy packs", requestId);
  }

  let query = supabase
    .from("policy_packs")
    .select(
      "id, user_id, organization_id, name, slug, description, level, source_type, parent_pack_id, parent_template_slug, default_verdict, rules, enabled, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  }

  const { data, error } = await query;
  if (error) return jsonDatabaseErrorResponse(requestId);

  const items = (data ?? []).map((r) => rowToPolicyPackDto(r as Record<string, unknown>));
  return attachRequestIdHeader(NextResponse.json({ items, scope }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required to create policy packs", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to create policy packs", requestId);
  }
  if (scope.organizationId && !scope.isAdmin) {
    return jsonErrorResponse(403, "Only workspace owners or admins can create policy packs", requestId);
  }

  const parsed = await readJsonBodyWithByteLimit(request, POLICY_PACK_BODY_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);
  const body = parsed.value;
  if (!isPlainObject(body)) {
    return jsonErrorResponse(400, "Request body must be a JSON object", requestId);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return jsonErrorResponse(400, "name is required (1..200 chars)", requestId);
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 2000)
      : null;

  const levelRaw = typeof body.level === "string" ? body.level : "workspace";
  if (levelRaw !== "workspace" && levelRaw !== "source") {
    return jsonErrorResponse(400, "level must be 'workspace' or 'source'", requestId);
  }
  const level = levelRaw as PolicyPackLevel;

  const sourceTypeRaw = body.sourceType;
  let sourceType: string | null = null;
  if (level === "source") {
    if (typeof sourceTypeRaw !== "string" || !VALID_SOURCES.includes(sourceTypeRaw as (typeof VALID_SOURCES)[number])) {
      return jsonErrorResponse(
        400,
        `sourceType must be one of ${VALID_SOURCES.join(", ")} for source-level packs`,
        requestId
      );
    }
    sourceType = sourceTypeRaw;
  } else if (sourceTypeRaw && sourceTypeRaw !== null) {
    return jsonErrorResponse(400, "workspace-level packs must omit sourceType", requestId);
  }

  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : deriveSlug(name);
  if (!isReasonableSlug(slug)) {
    return jsonErrorResponse(400, "slug must be 1..80 chars, lowercase letters/digits/hyphens", requestId);
  }

  const defaultVerdictRaw = typeof body.defaultVerdict === "string" ? body.defaultVerdict : "pass";
  if (!VALID_VERDICTS_FOR_DTO.includes(defaultVerdictRaw as (typeof VALID_VERDICTS_FOR_DTO)[number])) {
    return jsonErrorResponse(
      400,
      `defaultVerdict must be one of ${VALID_VERDICTS_FOR_DTO.join(", ")}`,
      requestId
    );
  }
  const defaultVerdict = defaultVerdictRaw as (typeof VALID_VERDICTS_FOR_DTO)[number];

  const enabled = body.enabled === false ? false : true;

  const rulesRaw = Array.isArray(body.rules) ? body.rules : [];
  const validation = validatePolicyRules(rulesRaw);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Rules validation failed", code: "validation_error", issues: validation.issues, requestId },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  const parentPackId =
    typeof body.parentPackId === "string" && body.parentPackId.trim() ? body.parentPackId.trim() : null;
  const parentTemplateSlug =
    typeof body.parentTemplateSlug === "string" && body.parentTemplateSlug.trim()
      ? body.parentTemplateSlug.trim()
      : null;

  if (parentTemplateSlug) {
    const builtIn = listBuiltInTemplateSlugs().includes(parentTemplateSlug);
    if (!builtIn) {
      const { data: tpl } = await supabase
        .from("policy_templates")
        .select("slug")
        .eq("slug", parentTemplateSlug)
        .maybeSingle();
      if (!tpl) {
        return jsonErrorResponse(400, `Unknown parentTemplateSlug "${parentTemplateSlug}"`, requestId);
      }
    }
  }

  if (parentPackId) {
    const { data: parent } = await supabase
      .from("policy_packs")
      .select("id, organization_id, user_id")
      .eq("id", parentPackId)
      .maybeSingle();
    if (!parent) {
      return jsonErrorResponse(400, "parentPackId does not exist or is not visible", requestId);
    }
    const sameOrg = scope.organizationId
      ? parent.organization_id === scope.organizationId
      : parent.organization_id === null && parent.user_id === scope.userId;
    if (!sameOrg) {
      return jsonErrorResponse(400, "parentPackId must be in the same scope", requestId);
    }
  }

  const { data, error } = await supabase
    .from("policy_packs")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      name,
      slug,
      description,
      level,
      source_type: sourceType,
      parent_pack_id: parentPackId,
      parent_template_slug: parentTemplateSlug,
      default_verdict: defaultVerdict,
      rules: validation.rules,
      enabled,
    })
    .select(
      "id, user_id, organization_id, name, slug, description, level, source_type, parent_pack_id, parent_template_slug, default_verdict, rules, enabled, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return jsonErrorResponse(409, "A policy pack with this slug already exists in this scope", requestId, "conflict");
    }
    return jsonDatabaseErrorResponse(requestId);
  }

  const dto = rowToPolicyPackDto((data ?? {}) as Record<string, unknown>);
  return attachRequestIdHeader(
    NextResponse.json({ item: dto, validation: { issues: validation.issues } }, { status: 201 }),
    requestId
  );
}
