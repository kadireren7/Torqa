"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, MessageSquare, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_GOVERNANCE_MODE,
  type GovernanceMode,
  type GovernanceModeView,
} from "@/lib/governance/types";
import { cn } from "@/lib/utils";

type ModeMeta = {
  value: GovernanceMode;
  title: string;
  helper: string;
  icon: React.ReactNode;
  tone: string;
};

const MODES: ModeMeta[] = [
  {
    value: "autonomous",
    title: "Autonomous",
    helper:
      "Safe auto-fixes apply immediately and write to the audit log. Structural fixes still queue for approval.",
    icon: <Zap className="h-4 w-4" aria-hidden />,
    tone: "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-100",
  },
  {
    value: "supervised",
    title: "Supervised",
    helper:
      "Every fix proposal queues for human approval. Recommended for production workspaces.",
    icon: <Eye className="h-4 w-4" aria-hidden />,
    tone: "border-sky-500/40 bg-sky-500/[0.08] text-sky-100",
  },
  {
    value: "interactive",
    title: "Interactive",
    helper:
      "Each finding asks for a rationale or response. Answers are remembered for re-scans so the same prompt isn't asked twice.",
    icon: <MessageSquare className="h-4 w-4" aria-hidden />,
    tone: "border-violet-500/40 bg-violet-500/[0.08] text-violet-100",
  },
];

export function GovernanceModeClient() {
  const [view, setView] = useState<GovernanceModeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<GovernanceMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/governance/mode", { credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { governance?: GovernanceModeView; error?: string } | null;
      if (!res.ok || !data?.governance) {
        setError(data?.error ?? "Could not load governance mode");
        return;
      }
      setView(data.governance);
    } catch {
      setError("Network error while loading governance mode");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = useCallback(
    async (mode: GovernanceMode) => {
      if (!view?.canChange) return;
      if (view.mode === mode) return;
      setSaving(mode);
      setError(null);
      try {
        const res = await fetch("/api/governance/mode", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = (await res.json().catch(() => null)) as { governance?: GovernanceModeView; error?: string } | null;
        if (!res.ok || !data?.governance) {
          setError(data?.error ?? "Could not change governance mode");
          return;
        }
        setView(data.governance);
      } catch {
        setError("Network error while saving governance mode");
      } finally {
        setSaving(null);
      }
    },
    [view]
  );

  const activeMode = view?.mode ?? DEFAULT_GOVERNANCE_MODE;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Governance Engine
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Operation mode</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Controls how Torqa acts on findings. The mode applies to every scan, fix proposal, and accepted risk in this scope.
          {view?.scope === "personal" ? " Personal scope is read-only — switch to a workspace to change the mode." : null}
        </p>
        {view ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Scope: {view.scope}</Badge>
            <Badge variant="outline">Active: {activeMode}</Badge>
            {!view.canChange ? <Badge variant="secondary">Read-only</Badge> : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => {
          const active = activeMode === m.value;
          const disabled = !view?.canChange || loading;
          return (
            <Card
              key={m.value}
              className={cn(
                "relative border-border/70 transition-shadow",
                active ? "ring-2 ring-primary/60" : "hover:shadow-md"
              )}
            >
              <CardHeader className="pb-3">
                <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", m.tone)}>
                  {m.icon}
                  {m.title}
                </div>
                <CardTitle className="mt-2 text-base">{m.title}</CardTitle>
                <CardDescription className="leading-relaxed">{m.helper}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "default"}
                  disabled={disabled || saving !== null}
                  onClick={() => void handleSelect(m.value)}
                  className="gap-1.5"
                >
                  {saving === m.value ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {active ? "Active" : "Set as active"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
