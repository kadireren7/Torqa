"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Shield, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AcceptedRiskRow } from "@/lib/governance/types";

type Filter = "active" | "revoked" | "all";

function severityBadgeClass(s: AcceptedRiskRow["severity"]): string {
  if (s === "critical" || s === "high") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (s === "review") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-slate-500/40 bg-slate-500/10 text-slate-100";
}

function isExpired(row: AcceptedRiskRow): boolean {
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() < Date.now();
}

export function AcceptedRisksClient() {
  const [items, setItems] = useState<AcceptedRiskRow[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accepted-risks?status=${filter}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { items?: AcceptedRiskRow[]; error?: string } | null;
      if (!res.ok || !data) {
        setError(data?.error ?? "Could not load accepted risks");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Network error while loading accepted risks");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = useCallback(
    async (id: string) => {
      setRevoking(id);
      setError(null);
      try {
        const res = await fetch(`/api/accepted-risks/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? `Revoke failed (${res.status})`);
          return;
        }
        await load();
      } catch {
        setError("Network error while revoking accepted risk");
      } finally {
        setRevoking(null);
      }
    },
    [load]
  );

  const counts = useMemo(() => {
    let active = 0;
    let expired = 0;
    let revoked = 0;
    for (const row of items) {
      if (row.revoked_at) {
        revoked += 1;
      } else if (isExpired(row)) {
        expired += 1;
      } else {
        active += 1;
      }
    }
    return { active, expired, revoked };
  }, [items]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Governance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Accepted risks</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Findings explicitly accepted as known risk. While active, they are filtered out of the gate decision and do not re-flag on re-scan.
          </p>
        </div>
        <Link href="/policies" className="text-sm font-medium text-primary hover:underline">
          ← Back to policies
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["active", "revoked", "all"] as Filter[]).map((f) => (
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
          Active: {counts.active} · Expired: {counts.expired} · Revoked: {counts.revoked}
        </span>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Registry
          </CardTitle>
          <CardDescription>
            Each row matches a deterministic finding signature. Revoke when the risk is no longer acceptable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading accepted risks…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accepted risks in this scope.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const expired = isExpired(row);
                  const status = row.revoked_at ? "revoked" : expired ? "expired" : "active";
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.rule_id}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{row.target}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={severityBadgeClass(row.severity)}>
                          {row.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(row.accepted_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            status === "active"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                              : status === "expired"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                                : "border-slate-500/40 bg-slate-500/10 text-slate-100"
                          }
                        >
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {status === "active" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={revoking !== null}
                            onClick={() => void handleRevoke(row.id)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            {revoking === row.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
