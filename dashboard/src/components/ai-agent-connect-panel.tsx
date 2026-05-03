"use client";

import { useState } from "react";
import { Bot, Loader2, X, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScanApiSuccess } from "@/lib/scan-engine";

type Tool = { name: string; description: string; permissions: string };

type FormState = {
  name: string;
  model: string;
  system_prompt: string;
  tools: Tool[];
  permissions: string;
  max_iterations: string;
  human_in_loop: boolean;
};

type PanelMode = "form" | "scanning" | "result" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
};

const INITIAL_FORM: FormState = {
  name: "",
  model: "",
  system_prompt: "",
  tools: [],
  permissions: "",
  max_iterations: "10",
  human_in_loop: false,
};

const COMMON_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-1.5-pro",
  "llama-3.1-70b",
];

export function AiAgentConnectPanel({ open, onClose }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [mode, setMode] = useState<PanelMode>("form");
  const [result, setResult] = useState<ScanApiSuccess | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addTool = () =>
    setForm((f) => ({ ...f, tools: [...f.tools, { name: "", description: "", permissions: "" }] }));

  const removeTool = (i: number) =>
    setForm((f) => ({ ...f, tools: f.tools.filter((_, idx) => idx !== i) }));

  const setTool = (i: number, field: keyof Tool, value: string) =>
    setForm((f) => {
      const tools = f.tools.map((t, idx) => (idx === i ? { ...t, [field]: value } : t));
      return { ...f, tools };
    });

  const buildPayload = () => ({
    name: form.name || "unnamed-agent",
    version: "1.0",
    model: form.model || undefined,
    system_prompt: form.system_prompt || undefined,
    tools: form.tools
      .filter((t) => t.name.trim())
      .map((t) => ({
        name: t.name.trim(),
        description: t.description.trim() || undefined,
        permissions: t.permissions
          ? t.permissions.split(",").map((p) => p.trim()).filter(Boolean)
          : [],
      })),
    permissions: form.permissions
      ? form.permissions.split(",").map((p) => p.trim()).filter(Boolean)
      : [],
    max_iterations: form.max_iterations ? parseInt(form.max_iterations, 10) : undefined,
    human_in_loop: form.human_in_loop,
  });

  const handleScan = async () => {
    setMode("scanning");
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "agent", content: buildPayload() }),
      });
      const j = (await res.json()) as ScanApiSuccess & { error?: string };
      if (!res.ok) {
        setErrorMsg(j.error ?? "Scan failed");
        setMode("error");
        return;
      }
      setResult(j);
      setMode("result");
    } catch {
      setErrorMsg("Network error — could not reach scan API");
      setMode("error");
    }
  };

  const reset = () => {
    setForm(INITIAL_FORM);
    setMode("form");
    setResult(null);
    setErrorMsg(null);
  };

  const decisionColor =
    result?.status === "PASS"
      ? "text-emerald-400"
      : result?.status === "FAIL"
      ? "text-red-400"
      : "text-yellow-400";

  const canScan = mode !== "scanning";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <Bot className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Connect AI Agent</p>
              <p className="text-xs text-muted-foreground">Define your agent for governance scanning</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Agent Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Agent Name
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. customer-support-agent"
              disabled={mode === "scanning"}
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Model
            </Label>
            <Input
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder="e.g. claude-sonnet-4-6"
              list="model-list"
              disabled={mode === "scanning"}
            />
            <datalist id="model-list">
              {COMMON_MODELS.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              System Prompt
            </Label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => set("system_prompt", e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={3}
              disabled={mode === "scanning"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {/* Tools */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tools
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                onClick={addTool}
                disabled={mode === "scanning"}
              >
                <Plus className="h-3 w-3" /> Add tool
              </Button>
            </div>
            {form.tools.length === 0 && (
              <p className="text-xs text-muted-foreground">No tools defined.</p>
            )}
            {form.tools.map((tool, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={tool.name}
                    onChange={(e) => setTool(i, "name", e.target.value)}
                    placeholder="Tool name (e.g. web_search)"
                    className="h-7 text-xs flex-1"
                    disabled={mode === "scanning"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeTool(i)}
                    disabled={mode === "scanning"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={tool.description}
                  onChange={(e) => setTool(i, "description", e.target.value)}
                  placeholder="Description (optional)"
                  className="h-7 text-xs"
                  disabled={mode === "scanning"}
                />
                <Input
                  value={tool.permissions}
                  onChange={(e) => setTool(i, "permissions", e.target.value)}
                  placeholder="Permissions, comma-separated (e.g. network, file_read)"
                  className="h-7 text-xs"
                  disabled={mode === "scanning"}
                />
              </div>
            ))}
          </div>

          {/* Agent Permissions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Agent Permissions
            </Label>
            <Input
              value={form.permissions}
              onChange={(e) => set("permissions", e.target.value)}
              placeholder="e.g. network, file_read (comma-separated)"
              disabled={mode === "scanning"}
            />
          </div>

          {/* Max Iterations + Human in Loop */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Max Iterations
              </Label>
              <Input
                type="number"
                value={form.max_iterations}
                onChange={(e) => set("max_iterations", e.target.value)}
                placeholder="10"
                min={1}
                disabled={mode === "scanning"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Human in Loop
              </Label>
              <div className="flex h-9 items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.human_in_loop}
                    onChange={(e) => set("human_in_loop", e.target.checked)}
                    disabled={mode === "scanning"}
                    className="h-4 w-4 rounded border border-input accent-violet-500"
                  />
                  <span className="text-sm">{form.human_in_loop ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Error */}
          {mode === "error" && errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* Result */}
          {mode === "result" && result && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.status === "PASS" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-sm font-medium">Scan complete</span>
                </div>
                <span className={`text-sm font-semibold ${decisionColor}`}>{result.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border/40 bg-card p-2">
                  <p className="text-lg font-bold">{result.riskScore}</p>
                  <p className="text-[10px] text-muted-foreground">Trust Score</p>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2">
                  <p className="text-lg font-bold text-red-400">{result.totals?.high ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">High</p>
                </div>
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2">
                  <p className="text-lg font-bold text-yellow-400">{result.totals?.review ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Review</p>
                </div>
              </div>
              {result.findings && result.findings.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {result.findings.slice(0, 8).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 shrink-0 font-medium ${
                        f.severity === "critical" || f.severity === "high" ? "text-red-400" :
                        f.severity === "review" ? "text-yellow-400" : "text-muted-foreground"
                      }`}>{f.severity.toUpperCase()}</span>
                      <span className="text-muted-foreground">{f.explanation}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={reset}>
                Scan another agent
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-6 py-4 flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          {mode !== "result" && (
            <Button
              type="button"
              size="sm"
              disabled={!canScan}
              onClick={() => void handleScan()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {mode === "scanning" ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scanning…</>
              ) : (
                "Run Governance Scan"
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
