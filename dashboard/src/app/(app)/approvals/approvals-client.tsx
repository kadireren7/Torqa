"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { PendingApprovalRow } from "@/lib/governance/types";

type Filter = "pending" | "approved" | "rejected" | "all";

function severityBadgeClass(s: PendingApprovalRow["severity"]): string {
  if (s === "critical" || s === "high") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (s === "review") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-slate-500/40 bg-slate-500/10 text-slate-100";
}

function fixTypeBadgeClass(t: PendingApprovalRow["fix_type"]): string {
  if (t === "safe_auto") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  if (t === "structural") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-slate-500/40 bg-slate-500/10 text-slate-100";
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function ApprovalsClient() {
  const [items, setItems] = useState<PendingApprovalRow[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rationale, setRationale] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pending-approvals?status=${filter}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { items?: PendingApprovalRow[]; error?: string } | null;
      if (!res.ok || !data) {
        setError(data?.error ?? "Could not load approvals");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Network error while loading approvals");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (id: string, action: "approve" | "reject") => {
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/pending-approvals/${encodeURIComponent(id)}/decision`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, rationale: rationale[id]?.trim() || null }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? `Decision failed (${res.status})`);
          return;
        }
        await load();
      } catch {
        setError("Network error while submitting decision");
      } finally {
        setBusyId(null);
      }
    },
    [load, rationale]
  );

  const counts = useMemo(() => {
    const out = { pending: 0, approved: 0, rejected: 0, expired: 0, cancelled: 0 } as Record<string, number>;
    for (const i of items) out[i.status] = (out[i.status] ?? 0) + 1;
    return out;
  }, [items]);

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Governance Engine</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pending approvals</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Fix proposals that need a human decision in supervised or interactive mode. Approving applies the patch and writes to the audit log; rejecting records the rationale.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              filter === f
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/60 bg-background/60 hover:bg-muted/40"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          Pending: {counts.pending ?? 0} · Approved: {counts.approved ?? 0} · Rejected: {counts.rejected ?? 0}
        </span>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading approvals…
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-3 h-6 w-6 opacity-60" />
            No approvals match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((row) => {
            const isOpen = activeId === row.id;
            const decided = row.status !== "pending";
            return (
              <Card key={row.id} className="border-border/70">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={severityBadgeClass(row.severity)}>
                      {row.severity}
                    </Badge>
                    <Badge variant="outline" className={fixTypeBadgeClass(row.fix_type)}>
                      <Wand2 className="mr-1 h-3 w-3" />
                      {row.fix_type}
                    </Badge>
                    <Badge variant="secondary">{row.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(row.created_at).toLocaleString()} · expires {new Date(row.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="mt-1 text-base">
                    <code className="font-mono text-sm">{row.rule_id}</code>{" "}
                    <span className="text-muted-foreground">@</span>{" "}
                    <span className="text-sm font-medium">{row.target}</span>
                  </CardTitle>
                  {row.explanation ? (
                    <CardDescription className="leading-relaxed">{row.explanation}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setActiveId(isOpen ? null : row.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {isOpen ? "Hide patch" : "View patch + diff"}
                  </button>
                  {isOpen ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300">Before</p>
                        <pre className="max-h-64 overflow-auto rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-2 font-mono text-[11px] leading-relaxed">
                          {formatJson(row.before_value)}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">After</p>
                        <pre className="max-h-64 overflow-auto rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] p-2 font-mono text-[11px] leading-relaxed">
                          {formatJson(row.after_value)}
                        </pre>
                      </div>
                    </div>
                  ) : null}

                  {!decided ? (
                    <div className="space-y-2">
                      <Label htmlFor={`rationale-${row.id}`} className="text-xs">
                        Decision rationale (optional)
                      </Label>
                      <textarea
                        id={`rationale-${row.id}`}
                        value={rationale[row.id] ?? ""}
                        onChange={(e) => setRationale((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        rows={2}
                        maxLength={4000}
                        className="block w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-xs"
                        placeholder="Why approve / reject?"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => void decide(row.id, "approve")}
                          className="h-8 gap-1.5 text-xs"
                        >
                          {busyId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId !== null}
                          onClick={() => void decide(row.id, "reject")}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : row.decided_rationale ? (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed">
                      <span className="font-semibold">Decision rationale:</span> {row.decided_rationale}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      Decision recorded {row.decided_at ? new Date(row.decided_at).toLocaleString() : ""}.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
