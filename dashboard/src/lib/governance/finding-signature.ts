/**
 * Deterministic signature for a finding so the same logical issue
 * across scans/runs/timeframes can be matched against:
 *  - applied fixes (avoid re-flagging once fixed)
 *  - accepted risks (filter pre-gate)
 *  - pending approvals (dedupe queue entries)
 *
 * Format: sha256("v1|" + source + "|" + rule_id + "|" + target) hex.
 */

import { createHash } from "node:crypto";
import type { ScanFinding, ScanSource } from "@/lib/scan-engine";

const SIGNATURE_VERSION = "v1";

export function buildFindingSignature(input: {
  source: string;
  rule_id: string;
  target: string;
}): string {
  const payload = `${SIGNATURE_VERSION}|${input.source}|${input.rule_id}|${input.target}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function buildFindingSignatureForScan(
  finding: Pick<ScanFinding, "rule_id" | "target">,
  source: ScanSource
): string {
  return buildFindingSignature({
    source,
    rule_id: finding.rule_id,
    target: finding.target,
  });
}
