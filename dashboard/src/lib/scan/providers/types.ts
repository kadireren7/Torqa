import type { ScanApiSuccess, ScanSource } from "@/lib/scan-engine";

/** Normalized input for all scan providers (matches POST /api/scan body fields). */
export type ScanProviderInput = {
  source: ScanSource;
  /** Parsed JSON object root (workflow / bundle snapshot). */
  content: Record<string, unknown>;
};

/**
 * Pluggable scan backend for POST /api/scan.
 * Implementations must return {@link ScanApiSuccess} (including `engine` discriminator).
 */
export interface ScanProvider {
  readonly id: string;
  readonly label: string;
  scan(input: ScanProviderInput): Promise<ScanApiSuccess>;
}

/** Thrown by providers or registry when the scan cannot complete; mapped to HTTP by the route. */
export class ScanProviderExecutionError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ScanProviderExecutionError";
  }
}
