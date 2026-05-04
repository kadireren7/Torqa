"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Shield, ShieldAlert, Wand2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ScanFinding, ScanSource } from "@/lib/scan-engine";
import type { FixType, GovernanceMode } from "@/lib/governance/types";

type ApplyResult =
  | { status: "applied"; appliedFix?: { id: string }; after?: unknown }
  | { status: "queued"; reason: string; pendingApproval?: { id: string } };

type AcceptResult = { item?: { id: string } };

export type FixProposalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: ScanFinding;
  source: ScanSource;
  /** Workflow JSON the scan was run against — required to apply patches. */
  content: unknown;
  /** Active governance mode at scan time. */
  mode: GovernanceMode;
  /** Optional scan id (DB) to attach to applied_fixes / pending_approvals. */
  scanId?: string | null;
  /** Triggered after a successful apply/queue/accept-risk so parent can refresh state. */
  onResolved?: (event:
    | { kind: "applied"; signature: string }
    | { kind: "queued"; signature: string }
    | { kind: "accepted"; signature: string }) => void;
};

function fixTypeBadge(type: FixType | undefined): { label: string; classes: string; icon: React.ReactNode } {
  if (type === "safe_auto") {
    return {
      label: "Safe auto-fix",
      classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
      icon: <Wand2 className="h-3.5 w-3.5" aria-hidden />,
    };
  }
  if (type === "structural") {
    return {
      label: "Structural — needs approval",
      classes: "border-amber-500/40 bg-amber-500/10 text-amber-200",
      icon: <ShieldAlert className="h-3.5 w-3.5" aria-hidden />,
    };
  }
  return {
    label: "Manual remediation",
    classes: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    icon: <ClipboardList className="h-3.5 w-3.5" aria-hidden />,
  };
}

function modeBadge(mode: GovernanceMode): { label: string; helper: string } {
  if (mode === "autonomous") {
    return {
      label: "Autonomous",
      helper: "Safe auto-fixes apply immediately. Structural fixes still queue.",
    };
  }
  if (mode === "interactive") {
    return {
      label: "Interactive",
      helper: "Your rationale is saved and remembered for future scans.",
    };
  }
  return {
    label: "Supervised",
    helper: "Every fix queues for approval before being applied.",
  };
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function FixProposalDialog({
  open,
  onOpenChange,
  finding,
  source,
  content,
  mode,
  scanId,
  onResolved,
}: FixProposalDialogProps) {
  const [busy, setBusy] = useState<"apply" | "accept" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [acceptDays, setAcceptDays] = useState<number | null>(90);

  useEffect(() => {
    if (!open) {
      setError(null);
      setInfo(null);
      setRationale("");
    }
  }, [open]);

  const fix = finding.fix;
  const badge = useMemo(() => fixTypeBadge(fix?.type), [fix?.type]);
  const modeMeta = useMemo(() => modeBadge(mode), [mode]);

  const willApplyImmediately = mode === "autonomous" && fix?.type === "safe_auto";

  async function handleApplyOrQueue() {
    if (!fix) return;
    setBusy("apply");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/fixes/apply", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: scanId ?? null,
          finding: {
            signature: fix.signature,
            rule_id: finding.rule_id,
            source,
            target: finding.target,
            severity: finding.severity,
          },
          fix: {
            type: fix.type,
            patch: fix.patch,
            explanation: fix.explanation,
          },
          content,
          rationale: rationale.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as ApplyResult | { error?: string } | null;
      if (!res.ok || !data) {
        const msg = data && "error" in data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
        setError(msg);
        return;
      }
      if ("status" in data && data.status === "applied") {
        setInfo("Fix applied. Audit log updated.");
        onResolved?.({ kind: "applied", signature: fix.signature });
      } else if ("status" in data && data.status === "queued") {
        setInfo(`Queued for approval — ${data.reason}.`);
        onResolved?.({ kind: "queued", signature: fix.signature });
      } else {
        setError("Unexpected response.");
      }
    } catch {
      setError("Network error while submitting fix.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAcceptRisk() {
    if (!fix) return;
    if (rationale.trim().length < 4) {
      setError("Rationale must be at least 4 characters to accept a risk.");
      return;
    }
    setBusy("accept");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/accepted-risks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: fix.signature,
          rule_id: finding.rule_id,
          source,
          target: finding.target,
          severity: finding.severity,
          rationale: rationale.trim(),
          expires_at: acceptDays,
        }),
      });
      const data = (await res.json().catch(() => null)) as AcceptResult | { error?: string } | null;
      if (!res.ok || !data) {
        const msg = data && "error" in data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
        setError(msg);
        return;
      }
      setInfo("Recorded in the Accepted Risk Registry.");
      onResolved?.({ kind: "accepted", signature: fix.signature });
    } catch {
      setError("Network error while recording accepted risk.");
    } finally {
      setBusy(null);
    }
  }

  if (!fix) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <SheetHeader className="border-b border-border/60 bg-muted/20 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badge.classes}`}
            >
              {badge.icon}
              {badge.label}
            </span>
            <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">
              Mode: {modeMeta.label}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
              {finding.severity}
            </Badge>
          </div>
          <SheetTitle className="mt-1 text-left text-base font-semibold">
            Fix proposal — {finding.rule_id}
          </SheetTitle>
          <SheetDescription className="text-left text-xs leading-relaxed">
            {modeMeta.helper}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Target
            </p>
            <p className="rounded-md border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs">
              {finding.target}
            </p>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              What this fix does
            </p>
            <p className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-sm leading-relaxed text-emerald-50/95">
              {fix.explanation}
            </p>
          </section>

          {fix.preview ? (
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Diff preview
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                    Before
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-2 font-mono text-[11px] leading-relaxed text-rose-100/90">
                    {formatJson(fix.preview.before)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    After
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] p-2 font-mono text-[11px] leading-relaxed text-emerald-100/90">
                    {formatJson(fix.preview.after)}
                  </pre>
                </div>
              </div>
            </section>
          ) : null}

          {fix.patch.length > 0 ? (
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Patch ({fix.patch.length} op{fix.patch.length === 1 ? "" : "s"})
              </p>
              <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
                {formatJson(fix.patch)}
              </pre>
            </section>
          ) : (
            <section className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100/95">
              No automatic patch available — this finding requires manual remediation. You can still record an accepted-risk rationale below.
            </section>
          )}

          <Separator />

          <section className="space-y-2">
            <Label htmlFor="rationale" className="text-xs font-medium">
              Rationale (optional for fixes, required to accept risk)
            </Label>
            <textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Why is this fix being applied / queued / accepted?"
              className="block w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium">Accept-risk expiry:</span>
              {[30, 90, 180].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setAcceptDays(d)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] ${
                    acceptDays === d
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 bg-background/60 hover:bg-muted/40"
                  }`}
                >
                  {d}d
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAcceptDays(null)}
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  acceptDays === null
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 bg-background/60 hover:bg-muted/40"
                }`}
              >
                Never expires
              </button>
            </div>
          </section>

          {error ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              {info}
            </p>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border/60 bg-muted/15 px-6 py-4 sm:flex-row sm:justify-between sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void handleAcceptRisk()}
            className="gap-1.5"
          >
            {busy === "accept" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            Accept risk
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || fix.patch.length === 0}
            onClick={() => void handleApplyOrQueue()}
            className="gap-1.5"
          >
            {busy === "apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {willApplyImmediately ? "Apply fix now" : "Queue for approval"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
