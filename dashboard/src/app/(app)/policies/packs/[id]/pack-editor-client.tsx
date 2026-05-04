"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VALID_RULE_FIELDS,
  VALID_RULE_OPERATORS,
  VALID_SOURCES,
  VALID_VERDICTS,
  type PolicyPack,
  type PolicyRule,
  type PolicyVerdict,
  type RuleCondition,
  type RuleField,
  type RuleOperator,
  type RulePredicate,
  type RuleScope,
} from "@/lib/governance/policy-v2/types";
import type { PolicyValidationIssue } from "@/lib/governance/policy-v2/validate";
import type { SimulationSummary } from "@/lib/governance/policy-v2/simulator";

const RULE_TEMPLATES: { label: string; rule: PolicyRule }[] = [
  {
    label: "Block on critical / high finding",
    rule: {
      id: "block-critical",
      name: "Block on critical or high finding",
      scope: "finding",
      when: { field: "severity", op: "in", value: ["critical", "high"] },
      then: "block",
      message: "Critical/high finding present.",
      enabled: true,
    },
  },
  {
    label: "Block plaintext secrets",
    rule: {
      id: "block-plaintext-secrets",
      name: "Block plaintext secrets",
      scope: "finding",
      when: { field: "rule_id", op: "eq", value: "v1.secret.plaintext_detected" },
      then: "block",
      message: "Plaintext secret detected.",
      enabled: true,
    },
  },
  {
    label: "Review when AI agent has any review-tier finding",
    rule: {
      id: "review-agent-review",
      name: "Review when AI agent flagged",
      scope: "finding",
      when: {
        all: [
          { field: "source", op: "eq", value: "ai-agent" },
          { field: "severity", op: "in", value: ["review", "high", "critical"] },
        ],
      },
      then: "review",
      message: "AI agent flagged a finding for review.",
      enabled: true,
    },
  },
  {
    label: "Block when risk score < 60",
    rule: {
      id: "block-low-trust",
      name: "Block when risk score below 60",
      scope: "scan",
      when: { field: "risk_score", op: "lt", value: 60 },
      then: "block",
      message: "Trust score below the policy floor (60).",
      enabled: true,
    },
  },
  {
    label: "Review when more than 5 findings",
    rule: {
      id: "review-many-findings",
      name: "Review when more than 5 findings",
      scope: "scan",
      when: { field: "findings_count", op: "gt", value: 5 },
      then: "review",
      message: "Workflow has more than 5 findings.",
      enabled: true,
    },
  },
];

type EditorState = PolicyPack;

export function PolicyPackEditorClient({ packId }: { packId: string }) {
  const router = useRouter();
  const [pack, setPack] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [issues, setIssues] = useState<PolicyValidationIssue[]>([]);
  const [parents, setParents] = useState<PolicyPack[]>([]);

  const [simRange, setSimRange] = useState<"last-7-days" | "last-30-days" | "last-90-days">("last-30-days");
  const [simLoading, setSimLoading] = useState(false);
  const [sim, setSim] = useState<SimulationSummary | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [self, all] = await Promise.all([
        fetch(`/api/policy-packs/${encodeURIComponent(packId)}`, { credentials: "include" }),
        fetch("/api/policy-packs", { credentials: "include" }),
      ]);
      if (!self.ok) {
        const j = (await self.json()) as { error?: string };
        setError(j.error ?? "Could not load pack");
        return;
      }
      const sj = (await self.json()) as { item?: PolicyPack };
      if (!sj.item) {
        setError("Pack not found");
        return;
      }
      setPack(sj.item);
      if (all.ok) {
        const aj = (await all.json()) as { items?: PolicyPack[] };
        setParents((aj.items ?? []).filter((p) => p.id !== sj.item!.id));
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ruleSummary = useMemo(() => {
    if (!pack) return { total: 0, blocking: 0, reviewing: 0, passing: 0 };
    let blocking = 0;
    let reviewing = 0;
    let passing = 0;
    for (const r of pack.rules) {
      if (r.then === "block") blocking += 1;
      else if (r.then === "review") reviewing += 1;
      else passing += 1;
    }
    return { total: pack.rules.length, blocking, reviewing, passing };
  }, [pack]);

  const updatePack = (next: Partial<EditorState>) => {
    setPack((p) => (p ? { ...p, ...next } : p));
  };

  const updateRule = (idx: number, next: PolicyRule) => {
    setPack((p) => {
      if (!p) return p;
      const rules = p.rules.slice();
      rules[idx] = next;
      return { ...p, rules };
    });
  };

  const removeRule = (idx: number) => {
    setPack((p) => {
      if (!p) return p;
      const rules = p.rules.slice();
      rules.splice(idx, 1);
      return { ...p, rules };
    });
  };

  const addRule = (template: PolicyRule) => {
    setPack((p) => {
      if (!p) return p;
      const seen = new Set(p.rules.map((r) => r.id));
      let id = template.id;
      let n = 1;
      while (seen.has(id)) {
        id = `${template.id}-${n}`;
        n += 1;
      }
      return { ...p, rules: [...p.rules, { ...template, id }] };
    });
  };

  const validate = useCallback(async () => {
    if (!pack) return;
    try {
      const res = await fetch("/api/policy-packs/validate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: pack.rules }),
      });
      const j = (await res.json()) as { ok?: boolean; issues?: PolicyValidationIssue[] };
      setIssues(Array.isArray(j.issues) ? j.issues : []);
    } catch {
      // ignore network errors during live validate
    }
  }, [pack]);

  useEffect(() => {
    const t = setTimeout(() => {
      void validate();
    }, 300);
    return () => clearTimeout(t);
  }, [validate]);

  const save = async () => {
    if (!pack) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/policy-packs/${encodeURIComponent(pack.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pack.name,
          description: pack.description,
          slug: pack.slug,
          defaultVerdict: pack.defaultVerdict,
          enabled: pack.enabled,
          parentPackId: pack.parentPackId,
          parentTemplateSlug: pack.parentTemplateSlug,
          level: pack.level,
          sourceType: pack.sourceType,
          rules: pack.rules,
        }),
      });
      const j = (await res.json()) as {
        item?: PolicyPack;
        error?: string;
        issues?: PolicyValidationIssue[];
      };
      if (!res.ok) {
        if (Array.isArray(j.issues)) setIssues(j.issues);
        setError(j.error ?? "Could not save pack");
        return;
      }
      if (j.item) {
        setPack(j.item);
        setSavedAt(new Date().toISOString());
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const runSim = async () => {
    if (!pack) return;
    setSimLoading(true);
    setSimError(null);
    setSim(null);
    try {
      const res = await fetch("/api/policy-packs/simulate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: pack.rules,
          defaultVerdict: pack.defaultVerdict,
          range: simRange,
        }),
      });
      const j = (await res.json()) as { summary?: SimulationSummary; error?: string };
      if (!res.ok || !j.summary) {
        setSimError(j.error ?? "Simulation failed");
        return;
      }
      setSim(j.summary);
    } catch {
      setSimError("Network error");
    } finally {
      setSimLoading(false);
    }
  };

  const remove = async () => {
    if (!pack) return;
    if (!confirm("Delete this policy pack?")) return;
    try {
      const res = await fetch(`/api/policy-packs/${encodeURIComponent(pack.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Delete failed");
        return;
      }
      router.push("/policies/packs");
    } catch {
      setError("Network error");
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pack…
      </p>
    );
  }
  if (error || !pack) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/policies/packs">
            <ArrowLeft className="h-4 w-4" />
            Back to packs
          </Link>
        </Button>
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error ?? "Pack not found."}
        </p>
      </div>
    );
  }

  const blockingIssues = issues.filter((i) => i.level === "error");
  const warningIssues = issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/policies/packs">
              <ArrowLeft className="h-4 w-4" />
              Packs
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{pack.name}</h1>
            <p className="text-xs text-muted-foreground">
              {pack.level === "source" ? `source · ${pack.sourceType}` : "workspace"} · {pack.rules.length} rule
              {pack.rules.length === 1 ? "" : "s"} · default {pack.defaultVerdict}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedAt ? (
            <span className="text-xs text-muted-foreground">Saved {new Date(savedAt).toLocaleTimeString()}</span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving || blockingIssues.length > 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Pack settings</CardTitle>
              <CardDescription>Names, default verdict, inheritance.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ed-name">Name</Label>
                <Input
                  id="ed-name"
                  value={pack.name}
                  onChange={(e) => updatePack({ name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-slug">Slug</Label>
                <Input
                  id="ed-slug"
                  value={pack.slug}
                  onChange={(e) => updatePack({ slug: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ed-desc">Description</Label>
                <Input
                  id="ed-desc"
                  value={pack.description ?? ""}
                  onChange={(e) => updatePack({ description: e.target.value || null })}
                  placeholder="Short summary of what this pack enforces"
                />
              </div>
              <div className="space-y-1">
                <Label>Default verdict</Label>
                <select
                  value={pack.defaultVerdict}
                  onChange={(e) => updatePack({ defaultVerdict: e.target.value as PolicyVerdict })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {VALID_VERDICTS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Enabled</Label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={pack.enabled}
                    onChange={(e) => updatePack({ enabled: e.target.checked })}
                  />
                  This pack will be evaluated on /scan
                </label>
              </div>
              <div className="space-y-1">
                <Label>Level</Label>
                <select
                  value={pack.level}
                  onChange={(e) => updatePack({ level: e.target.value as "workspace" | "source" })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="workspace">workspace</option>
                  <option value="source">source</option>
                </select>
              </div>
              {pack.level === "source" ? (
                <div className="space-y-1">
                  <Label>Source type</Label>
                  <select
                    value={pack.sourceType ?? "n8n"}
                    onChange={(e) => updatePack({ sourceType: e.target.value as PolicyPack["sourceType"] })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {VALID_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1 sm:col-span-2">
                <Label>Inherit from pack</Label>
                <select
                  value={pack.parentPackId ?? ""}
                  onChange={(e) => updatePack({ parentPackId: e.target.value || null })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.level === "source" ? `source · ${p.sourceType ?? ""}` : "workspace"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Inherit from baseline template</Label>
                <select
                  value={pack.parentTemplateSlug ?? ""}
                  onChange={(e) => updatePack({ parentTemplateSlug: e.target.value || null })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  <option value="startup-baseline">startup-baseline</option>
                  <option value="strict-security">strict-security</option>
                  <option value="agency-client-safe">agency-client-safe</option>
                  <option value="enterprise-governance">enterprise-governance</option>
                  <option value="n8n-production">n8n-production</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Rules</CardTitle>
                  <CardDescription>
                    {ruleSummary.total} rule{ruleSummary.total === 1 ? "" : "s"} · {ruleSummary.blocking} block /
                    {" "}
                    {ruleSummary.reviewing} review / {ruleSummary.passing} pass
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  {RULE_TEMPLATES.map((tpl) => (
                    <Button
                      key={tpl.rule.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addRule(tpl.rule)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {tpl.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pack.rules.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                  No rules yet. Add one from the templates above, or click below for an empty rule.
                </p>
              ) : (
                pack.rules.map((rule, i) => (
                  <RuleEditor
                    key={`${rule.id}-${i}`}
                    rule={rule}
                    onChange={(next) => updateRule(i, next)}
                    onDelete={() => removeRule(i)}
                    issues={issues.filter((x) => x.ruleIndex === i)}
                  />
                ))
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addRule({
                    id: `rule-${pack.rules.length + 1}`,
                    name: "New rule",
                    scope: "finding",
                    when: { field: "severity", op: "eq", value: "critical" },
                    then: "review",
                    enabled: true,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add empty rule
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Simulate
              </CardTitle>
              <CardDescription>Apply this pack to your past scans (read-only).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Time range</Label>
                <select
                  value={simRange}
                  onChange={(e) =>
                    setSimRange(
                      e.target.value === "last-7-days" || e.target.value === "last-90-days"
                        ? e.target.value
                        : "last-30-days"
                    )
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="last-7-days">Last 7 days</option>
                  <option value="last-30-days">Last 30 days</option>
                  <option value="last-90-days">Last 90 days</option>
                </select>
              </div>
              <Button type="button" onClick={() => void runSim()} disabled={simLoading} className="w-full">
                {simLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run simulation"}
              </Button>
              {simError ? <p className="text-xs text-destructive">{simError}</p> : null}
              {sim ? <SimulationView summary={sim} /> : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Validation</CardTitle>
              <CardDescription>Live linting of your rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {blockingIssues.length === 0 && warningIssues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  All rules look good.
                </p>
              ) : (
                <>
                  {blockingIssues.map((iss, i) => (
                    <p
                      key={`e${i}`}
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive"
                    >
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-mono">{iss.path}:</span> {iss.message}
                      </span>
                    </p>
                  ))}
                  {warningIssues.map((iss, i) => (
                    <p
                      key={`w${i}`}
                      className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"
                    >
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-mono">{iss.path}:</span> {iss.message}
                      </span>
                    </p>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function isPredicate(c: RuleCondition): c is RulePredicate {
  return !("all" in c) && !("any" in c) && !("not" in c);
}

function RuleEditor({
  rule,
  onChange,
  onDelete,
  issues,
}: {
  rule: PolicyRule;
  onChange: (next: PolicyRule) => void;
  onDelete: () => void;
  issues: PolicyValidationIssue[];
}) {
  const errors = issues.filter((i) => i.level === "error");
  return (
    <div
      className={`space-y-3 rounded-lg border ${
        errors.length ? "border-destructive/40 bg-destructive/5" : "border-border/70 bg-muted/20"
      } p-3`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono text-[10px]">
          {rule.id}
        </Badge>
        <Input
          value={rule.name}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          className="h-8"
          placeholder="Rule name"
        />
        <select
          value={rule.scope}
          onChange={(e) => onChange({ ...rule, scope: e.target.value as RuleScope })}
          className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="finding">finding</option>
          <option value="scan">scan</option>
        </select>
        <select
          value={rule.then}
          onChange={(e) => onChange({ ...rule, then: e.target.value as PolicyVerdict })}
          className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {VALID_VERDICTS.map((v) => (
            <option key={v} value={v}>
              → {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={rule.enabled !== false}
            onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
          />
          enabled
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ConditionEditor
        condition={rule.when}
        scope={rule.scope}
        onChange={(next) => onChange({ ...rule, when: next })}
      />

      <Input
        value={rule.message ?? ""}
        onChange={(e) => onChange({ ...rule, message: e.target.value || undefined })}
        placeholder="Optional message shown in scan reports"
        className="h-8"
      />

      {errors.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {errors.map((e, i) => (
            <li key={i}>
              <span className="font-mono">{e.path}:</span> {e.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ConditionEditor({
  condition,
  scope,
  onChange,
}: {
  condition: RuleCondition;
  scope: RuleScope;
  onChange: (next: RuleCondition) => void;
}) {
  // Top-level: render as `all` group for visual builder simplicity.
  // If user pastes complex JSON we still preserve roundtrip via raw view below.
  const items: RulePredicate[] = useMemo(() => {
    if (isPredicate(condition)) return [condition];
    if ("all" in condition) {
      return condition.all.filter(isPredicate) as RulePredicate[];
    }
    return [];
  }, [condition]);

  const setItems = (next: RulePredicate[]) => {
    if (next.length === 0) {
      onChange({ field: "severity", op: "eq", value: "critical" });
      return;
    }
    if (next.length === 1) {
      onChange(next[0]);
      return;
    }
    onChange({ all: next });
  };

  const updateItem = (idx: number, predicate: RulePredicate) => {
    const next = items.slice();
    next[idx] = predicate;
    setItems(next);
  };

  const addItem = () => {
    setItems([...items, { field: "severity", op: "eq", value: "critical" }]);
  };

  const removeItem = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    setItems(next);
  };

  return (
    <div className="space-y-2 rounded-md border border-border/40 bg-background/60 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        match all of:
      </p>
      {items.map((p, i) => (
        <PredicateRow
          key={i}
          predicate={p}
          scope={scope}
          onChange={(next) => updateItem(i, next)}
          onDelete={() => removeItem(i)}
        />
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={addItem}>
        <Plus className="h-3.5 w-3.5" />
        Add condition
      </Button>
    </div>
  );
}

function PredicateRow({
  predicate,
  scope,
  onChange,
  onDelete,
}: {
  predicate: RulePredicate;
  scope: RuleScope;
  onChange: (next: RulePredicate) => void;
  onDelete: () => void;
}) {
  const updateField = (f: RuleField) => {
    let next: RulePredicate = { ...predicate, field: f };
    if (f === "severity") next = { ...next, op: "eq", value: "critical" };
    else if (f === "source") next = { ...next, op: "eq", value: "n8n" };
    else if (
      f === "risk_score" ||
      f === "findings_count" ||
      f === "critical_count" ||
      f === "review_count" ||
      f === "info_count"
    ) {
      next = { ...next, op: "lt", value: 60 };
    } else {
      next = { ...next, op: "eq", value: "" };
    }
    onChange(next);
  };

  const updateOp = (op: RuleOperator) => {
    let nextValue: RulePredicate["value"] = predicate.value;
    if ((op === "in" || op === "not_in") && !Array.isArray(predicate.value)) {
      nextValue = typeof predicate.value === "string" ? [predicate.value] : [];
    } else if (op !== "in" && op !== "not_in" && Array.isArray(predicate.value)) {
      nextValue = (predicate.value[0] as string | number | undefined) ?? "";
    }
    onChange({ ...predicate, op, value: nextValue });
  };

  const allowedFields = VALID_RULE_FIELDS.filter((f) =>
    scope === "finding"
      ? !["risk_score", "findings_count", "critical_count", "review_count", "info_count"].includes(f)
      : ["risk_score", "findings_count", "critical_count", "review_count", "info_count", "source"].includes(f)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={predicate.field}
        onChange={(e) => updateField(e.target.value as RuleField)}
        className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {allowedFields.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select
        value={predicate.op}
        onChange={(e) => updateOp(e.target.value as RuleOperator)}
        className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {VALID_RULE_OPERATORS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ValueInput predicate={predicate} onChange={(v) => onChange({ ...predicate, value: v })} />
      <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ValueInput({
  predicate,
  onChange,
}: {
  predicate: RulePredicate;
  onChange: (v: RulePredicate["value"]) => void;
}) {
  const isArrOp = predicate.op === "in" || predicate.op === "not_in";
  if (isArrOp) {
    const arr = Array.isArray(predicate.value) ? predicate.value : [];
    return (
      <Input
        value={arr.join(", ")}
        onChange={(e) => {
          const isNumeric =
            predicate.field === "risk_score" ||
            predicate.field === "findings_count" ||
            predicate.field === "critical_count" ||
            predicate.field === "review_count" ||
            predicate.field === "info_count";
          const parts = e.target.value
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          if (isNumeric) {
            const nums = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n));
            onChange(nums);
          } else {
            onChange(parts);
          }
        }}
        placeholder="comma-separated values"
        className="h-8 w-56"
      />
    );
  }
  const isNumeric =
    predicate.field === "risk_score" ||
    predicate.field === "findings_count" ||
    predicate.field === "critical_count" ||
    predicate.field === "review_count" ||
    predicate.field === "info_count" ||
    predicate.op === "gt" ||
    predicate.op === "gte" ||
    predicate.op === "lt" ||
    predicate.op === "lte";
  return (
    <Input
      value={typeof predicate.value === "string" || typeof predicate.value === "number" ? String(predicate.value) : ""}
      onChange={(e) => onChange(isNumeric ? Number(e.target.value) || 0 : e.target.value)}
      type={isNumeric ? "number" : "text"}
      className="h-8 w-48"
    />
  );
}

function SimulationView({ summary }: { summary: SimulationSummary }) {
  if (summary.evaluated === 0) {
    return (
      <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        No scans found in the selected range. Run a scan or pick a wider window.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pass" value={summary.outcomes.pass} tone="ok" />
        <Stat label="Review" value={summary.outcomes.review} tone="warn" />
        <Stat label="Block" value={summary.outcomes.block} tone="bad" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <Delta label="newly blocked" value={summary.newlyBlocked} />
        <Delta label="newly review" value={summary.newlyReview} />
        <Delta label="newly passed" value={summary.newlyPassed} />
      </div>
      <details className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
        <summary className="cursor-pointer">Sample scans ({summary.scans.length})</summary>
        <ul className="mt-2 space-y-1 max-h-48 overflow-auto">
          {summary.scans.slice(0, 30).map((s) => (
            <li key={s.scanId} className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px]">{s.scanId.slice(0, 8)}…</span>
              <span>{s.workflowName ?? s.source}</span>
              <Badge variant="outline" className="text-[10px]">
                {s.priorStatus} → {s.newVerdict}
              </Badge>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-destructive/30 bg-destructive/5 text-destructive";
  return (
    <div className={`rounded-md border ${cls} p-2 text-center`}>
      <p className="text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Delta({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
