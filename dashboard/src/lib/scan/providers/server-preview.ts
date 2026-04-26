import { buildScanApiResult, type ScanApiSuccess } from "@/lib/scan-engine";
import type { ScanProvider, ScanProviderInput } from "./types";

/**
 * Default dashboard analyzer: deterministic TypeScript heuristics from {@link scan-engine}.
 * `engine` field in responses remains `"server-preview"`.
 */
export const serverPreviewProvider: ScanProvider = {
  id: "server-preview",
  label: "Dashboard server preview (TypeScript heuristics)",
  async scan(input: ScanProviderInput): Promise<ScanApiSuccess> {
    return buildScanApiResult(input.content, input.source);
  },
};
