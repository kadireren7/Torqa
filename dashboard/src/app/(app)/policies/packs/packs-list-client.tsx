"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PolicyPack } from "@/lib/governance/policy-v2/types";
import { hasPublicSupabaseUrl } from "@/lib/env";

const hasCloud = hasPublicSupabaseUrl();

export function PolicyPacksListClient() {
  const router = useRouter();
  const [items, setItems] = useState<PolicyPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLevel, setCreateLevel] = useState<"workspace" | "source">("workspace");
  const [createSource, setCreateSource] = useState<"n8n" | "generic" | "github" | "ai-agent">("n8n");

  const load = useCallback(async () => {
    if (!hasCloud) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/policy-packs", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign in to manage policy packs.");
          setItems([]);
          return;
        }
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Could not load policy packs");
        return;
      }
      const j = (await res.json()) as { items?: PolicyPack[] };
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/policy-packs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          level: createLevel,
          sourceType: createLevel === "source" ? createSource : null,
          rules: [],
          defaultVerdict: "pass",
          enabled: true,
        }),
      });
      const j = (await res.json()) as { item?: PolicyPack; error?: string };
      if (!res.ok || !j.item) {
        setError(j.error ?? "Could not create policy pack");
        return;
      }
      setCreateOpen(false);
      setCreateName("");
      router.push(`/policies/packs/${j.item.id}`);
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this policy pack? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/policy-packs/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Delete failed");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    }
  };

  const grouped = useMemo(() => {
    const workspace = items.filter((i) => i.level === "workspace");
    const source = items.filter((i) => i.level === "source");
    return { workspace, source };
  }, [items]);

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-3 border-b border-border/60 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Govern</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Policy packs</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Programmable governance: write rules like &quot;block when severity = critical and source = ai-agent&quot;. Inherit from
          a baseline template, override per source, simulate on past scans before activating.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" disabled={!hasCloud} onClick={() => setCreateOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            New pack
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/policies">Back to policies</Link>
          </Button>
        </div>
      </div>

      {!hasCloud ? (
        <p className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Connect Supabase to manage policy packs in this workspace.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading packs…
        </p>
      ) : (
        <>
          <PackSection title="Workspace packs" icon={ShieldCheck} packs={grouped.workspace} onDelete={remove} />
          <PackSection title="Source-scoped packs" icon={Layers} packs={grouped.source} onDelete={remove} />
        </>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">New policy pack</CardTitle>
              <CardDescription>You can edit rules and inheritance after creation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pp-name">Name</Label>
                <Input
                  id="pp-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Production guardrails"
                />
              </div>
              <div className="space-y-1">
                <Label>Level</Label>
                <select
                  value={createLevel}
                  onChange={(e) => setCreateLevel(e.target.value === "source" ? "source" : "workspace")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="workspace">Workspace (applies to any source)</option>
                  <option value="source">Source (only for one source type)</option>
                </select>
              </div>
              {createLevel === "source" ? (
                <div className="space-y-1">
                  <Label>Source type</Label>
                  <select
                    value={createSource}
                    onChange={(e) =>
                      setCreateSource(
                        (e.target.value as "n8n" | "generic" | "github" | "ai-agent") ?? "n8n"
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="n8n">n8n</option>
                    <option value="generic">generic</option>
                    <option value="github">github</option>
                    <option value="ai-agent">ai-agent</option>
                  </select>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void submitCreate()} disabled={creating || !createName.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function PackSection({
  title,
  icon: Icon,
  packs,
  onDelete,
}: {
  title: string;
  icon: typeof ShieldCheck;
  packs: PolicyPack[];
  onDelete: (id: string) => void;
}) {
  if (packs.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {packs.map((p) => (
          <Card key={p.id} className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <div className="flex flex-wrap gap-1">
                  {!p.enabled ? <Badge variant="outline" className="text-[10px]">Disabled</Badge> : null}
                  <Badge variant="secondary" className="text-[10px]">
                    Default · {p.defaultVerdict}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-xs">
                {p.level === "source" ? `source: ${p.sourceType ?? "?"}` : "workspace"}
                {" · "}
                {p.rules.length} rule{p.rules.length === 1 ? "" : "s"}
                {p.parentPackId ? " · inherits a pack" : null}
                {p.parentTemplateSlug ? ` · template: ${p.parentTemplateSlug}` : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-2">
              <Button asChild type="button" size="sm" variant="outline">
                <Link href={`/policies/packs/${encodeURIComponent(p.id)}`}>Open editor</Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(p.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
