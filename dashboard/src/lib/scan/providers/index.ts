import { hostedPythonProvider } from "./hosted-python";
import { pythonEngineProvider } from "./python-engine";
import { serverPreviewProvider } from "./server-preview";
import type { ScanProvider } from "./types";
import { ScanProviderExecutionError } from "./types";

const registry: Record<string, ScanProvider> = {
  [serverPreviewProvider.id]: serverPreviewProvider,
  [hostedPythonProvider.id]: hostedPythonProvider,
  [pythonEngineProvider.id]: pythonEngineProvider,
};

/** Ids registered in {@link registry} (for errors and docs). */
export const SCAN_PROVIDER_IDS = Object.freeze(Object.keys(registry));

/**
 * Reads `TORQA_SCAN_PROVIDER` (default `server-preview`).
 * Server-only; not exposed to the browser bundle for `/api/scan`.
 */
export function getConfiguredScanProviderId(): string {
  const raw = process.env.TORQA_SCAN_PROVIDER?.trim();
  if (!raw) return serverPreviewProvider.id;
  return raw.toLowerCase();
}

/**
 * Resolves the active scan provider for this process.
 * @throws {@link ScanProviderExecutionError} with HTTP 400 if the env id is unknown.
 */
export function getScanProvider(): ScanProvider {
  const id = getConfiguredScanProviderId();
  const provider = registry[id];
  if (!provider) {
    throw new ScanProviderExecutionError(
      `Unknown TORQA_SCAN_PROVIDER "${id}". Use one of: ${SCAN_PROVIDER_IDS.join(", ")}.`,
      400,
      "unknown_scan_provider"
    );
  }
  return provider;
}

export { serverPreviewProvider } from "./server-preview";
export { hostedPythonProvider } from "./hosted-python";
export { pythonEngineProvider } from "./python-engine";
export type { ScanProvider, ScanProviderInput } from "./types";
export { ScanProviderExecutionError } from "./types";
