/**
 * Server-side scan entry point for internal callers (ci/gate, config-run, etc.).
 * Wraps the active scan provider so routes don't import provider internals directly.
 */
import { getScanProvider } from "@/lib/scan/providers";
import { detectSource } from "@/lib/scan/source-registry";
import type { ScanApiSuccess, ScanSource } from "@/lib/scan-engine";

/**
 * Run a workflow scan using the configured scan provider.
 * @param content  Raw workflow JSON (object) or stringified JSON.
 * @param source   Source hint, e.g. "n8n", "github", "generic". Defaults to auto-detect.
 * @param name     Human-readable workflow name for tracing.
 */
export async function scanWorkflow(
  content: unknown,
  source: string = "generic",
  name: string = "workflow"
): Promise<ScanApiSuccess> {
  // Accept stringified JSON from API bodies
  let parsed: Record<string, unknown>;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      parsed = { raw: content, name };
    }
  } else if (content && typeof content === "object" && !Array.isArray(content)) {
    parsed = content as Record<string, unknown>;
  } else {
    parsed = { raw: String(content), name };
  }

  // Auto-detect source when caller passes "generic" or "auto"
  let resolvedSource: ScanSource = source as ScanSource;
  if (source === "generic" || source === "auto") {
    const detected = detectSource(parsed);
    resolvedSource = detected.source;
  }

  const provider = getScanProvider();
  return provider.scan({ source: resolvedSource, content: parsed });
}
