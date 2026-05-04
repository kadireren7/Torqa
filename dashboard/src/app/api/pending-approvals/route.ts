import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return attachRequestIdHeader(NextResponse.json({ items: [] }), requestId);
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to view pending approvals", requestId);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  let query = supabase
    .from("pending_approvals")
    .select(
      "id, scan_id, finding_signature, rule_id, source, target, severity, fix_type, fix_patch, before_value, after_value, explanation, status, created_at, expires_at, decided_at, decided_by, decided_rationale"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  }

  if (status === "all") {
    // no filter
  } else if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "expired" ||
    status === "cancelled"
  ) {
    query = query.eq("status", status);
  } else {
    return jsonErrorResponse(400, "status filter must be pending|approved|rejected|expired|cancelled|all", requestId);
  }

  const { data, error } = await query;
  if (error) return jsonDatabaseErrorResponse(requestId);

  return attachRequestIdHeader(NextResponse.json({ items: data ?? [] }), requestId);
}
