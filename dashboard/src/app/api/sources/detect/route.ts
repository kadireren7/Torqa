import { NextResponse } from "next/server";
import { detectSource } from "@/lib/scan/source-registry";
import {
  attachRequestIdHeader,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit, SCAN_JSON_BODY_MAX_BYTES } from "@/lib/request-body";

export const runtime = "nodejs";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Auto-detect the most likely source for a parsed JSON payload.
 * Pure function — does not run a scan, does not persist anything.
 *
 * Body:
 *   { content: object } | object
 * Response:
 *   { source, confidence, candidates }
 */
export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const parsed = await readJsonBodyWithByteLimit(request, SCAN_JSON_BODY_MAX_BYTES);
  if (!parsed.ok) {
    return jsonErrorResponse(
      parsed.status,
      parsed.message,
      requestId,
      parsed.status === 413 ? "payload_too_large" : "bad_request"
    );
  }
  const body = parsed.value;
  const content =
    isPlainObject(body) && isPlainObject(body.content) ? body.content : body;
  if (!isPlainObject(content)) {
    return jsonErrorResponse(
      400,
      "Body must be a JSON object (or { content: object })",
      requestId,
      "bad_request"
    );
  }

  const result = detectSource(content);
  return attachRequestIdHeader(NextResponse.json(result), requestId);
}
