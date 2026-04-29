"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { hasPublicSupabaseUrl } from "@/lib/env";

const useCloud = hasPublicSupabaseUrl();

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type UsageLog = {
  id: number;
  endpoint: string;
  source: string | null;
  statusCode: number;
  success: boolean;
  errorCode: string | null;
  requestIp: string | null;
  createdAt: string;
  apiKeyId: string | null;
};

export default function ApiSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageLog[]>([]);
  const [rawNewKey, setRawNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/api-keys", { credentials: "include" });
      const j = (await res.json()) as { keys?: ApiKey[]; usage?: UsageLog[]; error?: string };
      if (!res.ok) {
        setMessage(j.error ?? "Could not load API keys");
        return;
      }
      setKeys(j.keys ?? []);
      setUsage(j.usage ?? []);
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!useCloud) {
      setLoading(false);
      return;
    }
    void load();
  }, [load]);

  const activeCount = useMemo(() => keys.filter((k) => !k.revokedAt).length, [keys]);

  const createKey = async () => {
    if (!name.trim()) {
      setMessage("Key name is required");
      return;
    }
    setSaving(true);
    setMessage(null);
    setRawNewKey(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = (await res.json()) as { rawKey?: string; error?: string };
      if (!res.ok) {
        setMessage(j.error ?? "Could not create key");
        return;
      }
      setRawNewKey(j.rawKey ?? null);
      setName("");
      setMessage("API key created. Copy it now; it will not be shown again.");
      await load();
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  };

  const revokeKey = async (id: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoke: true }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(j.error ?? "Could not revoke key");
        return;
      }
      setMessage("Key revoked.");
      await load();
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (!useCloud) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">User API</h1>
        <p className="text-sm text-muted-foreground">
          Connect Supabase and set <code className="rounded bg-muted px-1 font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          to enable API key auth for <code className="rounded bg-muted px-1 font-mono text-xs">POST /api/public/scan</code>.
        </p>
        <p className="text-sm text-muted-foreground">
          OpenAPI 3 spec (same host):{" "}
          <Link href="/openapi.yaml" className="font-medium text-primary underline-offset-4 hover:underline">
            /openapi.yaml
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">User API</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate and revoke keys for server-to-server scans. Raw secrets are shown once and only stored as hashes. OpenAPI:{" "}
          <Link href="/openapi.yaml" className="font-medium text-primary underline-offset-4 hover:underline">
            /openapi.yaml
          </Link>
        </p>
      </div>

      <Card className="border-border/80 bg-muted/15 shadow-sm">
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What this does</p>
            <p className="mt-1">Creates scoped API keys for server-to-server scans through Torqa public endpoints.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Works now</p>
            <p className="mt-1">One-time key reveal, revoke flow, and usage log trail for key activity.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Next up</p>
            <p className="mt-1">Per-key scopes, stricter rate limiting tiers, and org-level audit overlays.</p>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void createKey()} disabled={saving || loading}>
              Generate your first API key
            </Button>
          </div>
        </CardContent>
      </Card>

      {message && (
        <p className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm text-foreground">{message}</p>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-4 w-4" aria-hidden />
            API key management
          </CardTitle>
          <CardDescription>
            Active keys: <strong className="text-foreground">{activeCount}</strong>. Use{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">x-api-key</code> or Bearer token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                placeholder="CI scanner"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" disabled={saving || loading} onClick={() => void createKey()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate key"}
              </Button>
            </div>
          </div>

          {rawNewKey && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-1 text-sm font-medium text-amber-900 dark:text-amber-100">Copy this key now</p>
              <code className="block break-all text-xs text-amber-900/80 dark:text-amber-100/90">{rawNewKey}</code>
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No keys yet.</p>
            ) : (
              keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Prefix {key.keyPrefix}… · Created {new Date(key.createdAt).toLocaleString()} · Last used{" "}
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "never"}
                    </p>
                  </div>
                  {key.revokedAt ? (
                    <Badge variant="secondary">Revoked</Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => void revokeKey(key.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Public scan endpoint
          </CardTitle>
          <CardDescription>
            <code className="rounded bg-muted px-1 font-mono text-[11px]">POST /api/public/scan</code> accepts{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">{`{ source, content }`}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <code className="block whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">{`curl -X POST "https://your-app.example/api/public/scan" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: torqa_live_..." \\
  -d '{"source":"n8n","content":{"nodes":[]}}'`}</code>
          <p className="text-xs text-muted-foreground">
            Includes a placeholder rate-limit header contract and writes usage logs for audit.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Usage logs</CardTitle>
          <CardDescription>Latest 50 API calls using your keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage yet.</p>
          ) : (
            usage.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {log.endpoint} · {log.statusCode}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()} · source {log.source ?? "n/a"} · ip{" "}
                    {log.requestIp ?? "unknown"}
                  </p>
                </div>
                <Badge variant={log.success ? "secondary" : "destructive"}>
                  {log.success ? "Success" : log.errorCode ?? "Error"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
