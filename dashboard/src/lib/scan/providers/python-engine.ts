import type { ScanApiSuccess } from "@/lib/scan-engine";
import type { ScanProvider, ScanProviderInput } from "./types";
import { ScanProviderExecutionError } from "./types";

/**
 * Future: run the real Torqa Python engine against `input` (validate / scan JSON).
 *
 * Planned integration paths (pick one per deployment — never execute arbitrary user code in-process):
 * - **Hosted service:** HTTPS call to a Torqa API worker (queue + signed payload, versioned contract).
 * - **Worker job:** enqueue scan, poll result object storage (same JSON shape as today).
 * - **Isolated subprocess:** only in trusted worker environments — not on Vercel serverless by default.
 *
 * TODO: define transport (gRPC/HTTP), auth (mTLS or signed JWT), timeouts, and payload caps.
 * TODO: map Python `torqa scan --json` output to {@link ScanApiSuccess} (or extend type with `engine: "torqa-python"`).
 */
export const pythonEngineProvider: ScanProvider = {
  id: "python-engine",
  label: "Torqa Python engine (not wired)",
  async scan(_unused: ScanProviderInput): Promise<ScanApiSuccess> {
    void _unused;
    throw new ScanProviderExecutionError(
      "Torqa Python engine provider is not active yet. Set TORQA_SCAN_PROVIDER=server-preview, or wire python-engine to a hosted Torqa worker / CLI job. See dashboard README.",
      503,
      "python_engine_not_configured"
    );
  },
};
