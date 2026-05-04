import { NextResponse } from "next/server";
import { validatePolicyRules } from "@/lib/governance/policy-v2/validate";
import {
  attachRequestIdHeader,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";

export const runtime = "nodejs";

const POLICY_PACK_BODY_MAX_BYTES = 256 * 1024;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Lints a rules array without persisting anything. Used by the editor for
 * real-time feedback and by CLI integrations to validate before push.
 */
export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const parsed = await readJsonBodyWithByteLimit(request, POLICY_PACK_BODY_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);

  const body = parsed.value;
  let rulesValue: unknown;
  if (Array.isArray(body)) {
    rulesValue = body;
  } else if (isPlainObject(body) && Array.isArray(body.rules)) {
    rulesValue = body.rules;
  } else {
    return jsonErrorResponse(400, "Body must be an array of rules or { rules: [...] }", requestId);
  }

  const validation = validatePolicyRules(rulesValue);
  return attachRequestIdHeader(
    NextResponse.json({
      ok: validation.ok,
      issues: validation.issues,
      ruleCount: validation.rules.length,
    }),
    requestId
  );
}
