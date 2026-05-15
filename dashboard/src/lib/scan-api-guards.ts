import type { ScanApiSuccess } from "@/lib/scan-engine";

export function isScanApiSuccess(data: unknown): data is ScanApiSuccess {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  const t = o.totals;
  if (!t || typeof t !== "object" || Array.isArray(t)) return false;
  const totals = t as Record<string, unknown>;
  const statusOk = o.status === "PASS" || o.status === "NEEDS REVIEW" || o.status === "FAIL";
  const sourceOk =
    o.source === "n8n" ||
    o.source === "generic" ||
    o.source === "github" ||
    o.source === "ai-agent" ||
    o.source === "make" ||
    o.source === "zapier" ||
    o.source === "lambda" ||
    o.source === "mcp";
  const engineOk = o.engine === "server-preview" || o.engine === "server-v1" || o.engine === "hosted-python";
  const modeOk =
    o.engine_mode === undefined ||
    o.engine_mode === "hosted_python" ||
    o.engine_mode === "server_preview" ||
    o.engine_mode === "local_python" ||
    o.engine_mode === "fallback_preview" ||
    o.engine_mode === "unknown";
  const analysisKindOk =
    o.analysis_kind === undefined ||
    o.analysis_kind === "real_engine" || o.analysis_kind === "preview_heuristic" || o.analysis_kind === "unknown";
  const fb = o.fallback;
  const fallbackOk =
    fb === undefined ||
    (!!fb &&
      typeof fb === "object" &&
      !Array.isArray(fb) &&
      typeof (fb as Record<string, unknown>).fallback_used === "boolean");
  return (
    engineOk &&
    modeOk &&
    analysisKindOk &&
    fallbackOk &&
    typeof o.riskScore === "number" &&
    Array.isArray(o.findings) &&
    statusOk &&
    sourceOk &&
    typeof totals.high === "number" &&
    typeof totals.review === "number" &&
    typeof totals.info === "number" &&
    typeof totals.all === "number"
  );
}
