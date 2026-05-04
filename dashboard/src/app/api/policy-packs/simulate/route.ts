import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import { resolvePolicyPack, resolveAdHocPack } from "@/lib/governance/policy-v2/resolver";
import { validatePolicyRules } from "@/lib/governance/policy-v2/validate";
import { simulatePolicyPack, type SimulationRange } from "@/lib/governance/policy-v2/simulator";
import { VALID_VERDICTS_FOR_DTO } from "@/lib/governance/policy-v2/dto";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";

export const runtime = "nodejs";

const SIMULATE_BODY_MAX_BYTES = 256 * 1024;
const VALID_RANGES: SimulationRange[] = ["last-7-days", "last-30-days", "last-90-days"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * What-if simulation: run a policy pack (saved or ad-hoc) against historical
 * scans for the active scope and return aggregate impact counts.
 */
export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Simulation requires Supabase", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) return jsonErrorResponse(401, "Sign in required", requestId);

  const parsed = await readJsonBodyWithByteLimit(request, SIMULATE_BODY_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);
  const body = parsed.value;
  if (!isPlainObject(body)) return jsonErrorResponse(400, "Body must be a JSON object", requestId);

  const range = (typeof body.range === "string" ? body.range : "last-30-days") as SimulationRange;
  if (!VALID_RANGES.includes(range)) {
    return jsonErrorResponse(400, `range must be one of ${VALID_RANGES.join(", ")}`, requestId);
  }

  const packId = typeof body.packId === "string" && body.packId.trim() ? body.packId.trim() : null;

  if (packId) {
    const resolved = await resolvePolicyPack(supabase, packId);
    if (!resolved) return jsonErrorResponse(404, "Pack not found or not visible", requestId);
    const summary = await simulatePolicyPack(supabase, scope, resolved, range);
    return attachRequestIdHeader(NextResponse.json({ summary, pack: { name: resolved.name, id: resolved.packId } }), requestId);
  }

  // Ad-hoc: rules + defaultVerdict in body.
  const rulesRaw = Array.isArray(body.rules) ? body.rules : null;
  if (!rulesRaw) {
    return jsonErrorResponse(400, "Either packId or rules[] must be supplied", requestId);
  }
  const validation = validatePolicyRules(rulesRaw);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Rules validation failed", code: "validation_error", issues: validation.issues, requestId },
      { status: 400, headers: { "x-request-id": requestId } }
    );
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

  const adhoc = resolveAdHocPack(validation.rules, defaultVerdict);
  const summary = await simulatePolicyPack(supabase, scope, adhoc, range);

  return attachRequestIdHeader(
    NextResponse.json({ summary, pack: { name: adhoc.name, id: null } }),
    requestId
  );
}
