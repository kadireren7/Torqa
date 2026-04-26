import { createAnonSupabase } from "@/lib/supabase/anon-server";
import { isScanApiSuccess } from "@/lib/scan-api-guards";
import type { ScanApiSuccess } from "@/lib/scan-engine";

export type SharedScanPayload = {
  result: ScanApiSuccess;
  source: string;
  workflow_name: string | null;
  created_at: string;
};

const SHARE_ID_RE = /^tq_[a-f0-9]{48}$/;

export function isValidShareId(id: string): boolean {
  return SHARE_ID_RE.test(id);
}

export async function fetchSharedScanByShareId(shareId: string): Promise<SharedScanPayload | null> {
  if (!isValidShareId(shareId)) return null;
  const supabase = createAnonSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_scan_by_share_id", { p_share_id: shareId });
  if (error || data == null) return null;

  const rows = Array.isArray(data) ? data : [data];
  const row = rows[0];
  if (!row || typeof row !== "object") return null;

  const r = row as Record<string, unknown>;
  if (!isScanApiSuccess(r.result)) return null;

  return {
    result: r.result,
    source: typeof r.source === "string" ? r.source : "generic",
    workflow_name: typeof r.workflow_name === "string" ? r.workflow_name : null,
    created_at: typeof r.created_at === "string" ? r.created_at : String(r.created_at ?? ""),
  };
}
