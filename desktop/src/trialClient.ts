/** P135: best-effort local telemetry — no-op in browser / missing bridge. */

export function recordTrialEvent(type: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const s = window.torqaShell;
  if (!s?.trialRecordEvent) return;
  void s.trialRecordEvent({ type, detail }).catch(() => {});
}
