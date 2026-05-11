"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CalendarClock, ChevronDown, ChevronRight,
  GitPullRequest, Hash, History, Loader2, Play, Plus,
  RefreshCw, Settings2, Shield, Trash2,
  ToggleLeft, ToggleRight, Webhook, X, Zap, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTION_META, TRIGGER_META,
  type ActionType, type TriggerType,
  type Playbook, type PlaybookAction, type PlaybookRun, type PlaybookTrigger,
} from "@/lib/playbooks";

const EASE = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: i * 0.05 } }),
};

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  "notify.slack":           Hash,
  "notify.email":           Mail,
  "notify.webhook":         Webhook,
  "github.create_pr":       GitPullRequest,
  "scan.rescan":            RefreshCw,
  "governance.accept_risk": Shield,
  "governance.block":       Shield,
};

const TRIGGER_TYPES: TriggerType[] = [
  "scan.fail", "scan.review", "scan.pass",
  "trust_score.below", "policy.violation", "manual",
];

const ACTION_TYPES: ActionType[] = [
  "notify.slack", "notify.email", "notify.webhook",
  "github.create_pr", "scan.rescan",
  "governance.accept_risk", "governance.block",
];

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(s: string): string {
  if (s === "success")  return "var(--emerald)";
  if (s === "partial")  return "var(--amber)";
  if (s === "failed")   return "var(--rose)";
  if (s === "running")  return "var(--accent)";
  return "var(--fg-4)";
}

// ── Default action configs ───────────────────────────────────────────────────

function defaultAction(type: ActionType): PlaybookAction {
  switch (type) {
    case "notify.slack":          return { type, config: { message: "{{decision}} — {{workflow_name}} (score: {{trust_score}})" } };
    case "notify.email":          return { type, config: { to: "", message: "{{decision}} on {{workflow_name}}" } };
    case "notify.webhook":        return { type, config: { url: "", method: "POST" } };
    case "github.create_pr":      return { type, config: { draft: true, label: "torqa-fix" } };
    case "scan.rescan":           return { type, config: { delay_minutes: 0 } };
    case "governance.accept_risk":return { type, config: { rationale: "Auto-accepted by playbook" } };
    case "governance.block":      return { type, config: { reason: "Blocked by governance policy" } };
  }
}

// ── Playbook Editor Modal ────────────────────────────────────────────────────

type EditorProps = {
  initial?: Playbook | null;
  onSave: (data: {
    name: string; description: string; trigger: PlaybookTrigger;
    actions: PlaybookAction[]; enabled: boolean;
  }) => Promise<void>;
  onClose: () => void;
};

function PlaybookEditor({ initial, onSave, onClose }: EditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(
    (initial?.trigger?.type as TriggerType) ?? "scan.fail"
  );
  const [triggerThreshold, setTriggerThreshold] = useState(
    (initial?.trigger as { config?: { threshold?: number } })?.config?.threshold ?? 60
  );
  const [triggerRuleId, setTriggerRuleId] = useState(
    (initial?.trigger as { config?: { rule_id?: string } })?.config?.rule_id ?? ""
  );
  const [actions, setActions] = useState<PlaybookAction[]>(
    initial?.actions ?? [defaultAction("notify.slack")]
  );
  const [saving, setSaving] = useState(false);

  const addAction = (type: ActionType) => {
    setActions(prev => [...prev, defaultAction(type)]);
  };

  const removeAction = (i: number) => {
    setActions(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateActionConfig = (i: number, key: string, value: unknown) => {
    setActions(prev => prev.map((a, idx) =>
      idx === i ? { ...a, config: { ...(a.config as Record<string, unknown>), [key]: value } } as PlaybookAction : a
    ));
  };

  const buildTrigger = (): PlaybookTrigger => {
    if (triggerType === "trust_score.below") return { type: triggerType, config: { threshold: triggerThreshold } };
    if (triggerType === "policy.violation")  return { type: triggerType, config: { rule_id: triggerRuleId } };
    return { type: triggerType } as PlaybookTrigger;
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description, trigger: buildTrigger(), actions, enabled: true });
    setSaving(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line-2)" }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)" }}>
              <Zap className="h-4 w-4" style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>
              {initial ? "Edit playbook" : "New playbook"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-opacity hover:opacity-60" style={{ color: "var(--fg-3)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Auto fix on scan failure"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line-2)", color: "var(--fg-1)" }}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Description <span style={{ color: "var(--fg-4)" }}>(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this playbook do?"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line-2)", color: "var(--fg-1)" }}
            />
          </div>

          {/* Trigger */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Trigger — when does this fire?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRIGGER_TYPES.map(t => {
                const meta = TRIGGER_META[t];
                const selected = triggerType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTriggerType(t)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] text-left transition-all duration-150"
                    style={selected
                      ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)", border: `1px solid color-mix(in srgb, var(--accent) 40%, transparent)`, color: "var(--fg-1)" }
                      : { background: "var(--overlay-sm)", border: "1px solid var(--line)", color: "var(--fg-3)" }
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: selected ? "var(--accent)" : meta.color }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {triggerType === "trust_score.below" && (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}>
                <span className="text-[12px]" style={{ color: "var(--fg-3)" }}>Threshold</span>
                <input
                  type="number"
                  min={0} max={100}
                  value={triggerThreshold}
                  onChange={e => setTriggerThreshold(Number(e.target.value))}
                  className="w-16 rounded-md px-2 py-1 text-[13px] text-center outline-none"
                  style={{ background: "var(--overlay-md)", border: "1px solid var(--line-2)", color: "var(--fg-1)" }}
                />
                <span className="text-[12px]" style={{ color: "var(--fg-4)" }}>/ 100</span>
              </div>
            )}
            {triggerType === "policy.violation" && (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}>
                <span className="text-[12px]" style={{ color: "var(--fg-3)" }}>Rule ID</span>
                <input
                  value={triggerRuleId}
                  onChange={e => setTriggerRuleId(e.target.value)}
                  placeholder="v1.n8n.credential_in_env"
                  className="flex-1 rounded-md px-2 py-1 font-mono text-[12px] outline-none"
                  style={{ background: "var(--overlay-md)", border: "1px solid var(--line-2)", color: "var(--fg-1)" }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>
                Actions — what happens when it fires?
              </label>
            </div>

            <div className="space-y-2">
              {actions.map((action, i) => {
                const meta = ACTION_META[action.type];
                const Icon = ACTION_ICONS[action.type];
                return (
                  <div key={i} className="rounded-xl p-3" style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "var(--overlay-md)" }}>
                          <Icon className="h-3 w-3" style={{ color: meta.color }} />
                        </span>
                        <span className="text-[12px] font-medium" style={{ color: "var(--fg-1)" }}>{meta.label}</span>
                      </div>
                      <button onClick={() => removeAction(i)} className="rounded p-1 transition-opacity hover:opacity-60" style={{ color: "var(--fg-4)" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <ActionConfigEditor action={action} onChange={(key, val) => updateActionConfig(i, key, val)} />
                  </div>
                );
              })}
            </div>

            {/* Add action */}
            <div
              className="rounded-xl p-2"
              style={{ background: "var(--overlay-sm)", border: "1px dashed var(--line-2)" }}
            >
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>
                Add action
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ACTION_TYPES.map(t => {
                  const meta = ACTION_META[t];
                  const Icon = ACTION_ICONS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => addAction(t)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all hover:opacity-80"
                      style={{ background: "var(--overlay-md)", border: "1px solid var(--line)", color: "var(--fg-2)" }}
                    >
                      <Icon className="h-3 w-3" style={{ color: meta.color }} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t p-4" style={{ borderColor: "var(--line)" }}>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] transition-opacity hover:opacity-60"
            style={{ color: "var(--fg-3)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity",
              (saving || !name.trim()) && "opacity-50 cursor-not-allowed")}
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? "Save changes" : "Create playbook"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Per-action config fields ─────────────────────────────────────────────────

function ActionConfigEditor({
  action,
  onChange,
}: {
  action: PlaybookAction;
  onChange: (key: string, value: unknown) => void;
}) {
  const cfg = action.config as Record<string, unknown>;
  const field = (key: string, label: string, placeholder = "") => (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px]" style={{ color: "var(--fg-4)" }}>{label}</span>
      <input
        value={String(cfg[key] ?? "")}
        onChange={e => onChange(key, e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md px-2 py-1 text-[12px] outline-none"
        style={{ background: "var(--overlay-md)", border: "1px solid var(--line)", color: "var(--fg-1)" }}
      />
    </div>
  );

  switch (action.type) {
    case "notify.slack":
      return (
        <div className="space-y-1.5">
          {field("webhook_url", "Webhook URL", "https://hooks.slack.com/...")}
          {field("message", "Message", "{{decision}} — {{workflow_name}}")}
        </div>
      );
    case "notify.email":
      return (
        <div className="space-y-1.5">
          {field("to", "To", "security@company.com")}
          {field("message", "Body", "{{decision}} on {{workflow_name}}")}
        </div>
      );
    case "notify.webhook":
      return (
        <div className="space-y-1.5">
          {field("url", "URL", "https://api.example.com/torqa")}
        </div>
      );
    case "github.create_pr":
      return (
        <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
          Opens a draft PR on the connected GitHub repo. Requires GitHub source.
        </p>
      );
    case "scan.rescan":
      return (
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>Delay</span>
          <input
            type="number" min={0}
            value={Number(cfg.delay_minutes ?? 0)}
            onChange={e => onChange("delay_minutes", Number(e.target.value))}
            className="w-16 rounded-md px-2 py-1 text-[12px] text-center outline-none"
            style={{ background: "var(--overlay-md)", border: "1px solid var(--line)", color: "var(--fg-1)" }}
          />
          <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>minutes</span>
        </div>
      );
    case "governance.accept_risk":
      return field("rationale", "Rationale", "Auto-accepted by playbook");
    case "governance.block":
      return field("reason", "Reason", "Blocked by governance policy");
    default:
      return null;
  }
}

// ── Playbook Card ─────────────────────────────────────────────────────────────

function PlaybookCard({
  playbook,
  onToggle,
  onRun,
  onEdit,
  onDelete,
  running,
}: {
  playbook: Playbook;
  onToggle: () => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = TRIGGER_META[playbook.trigger.type as TriggerType];
  const actions = (playbook.actions as PlaybookAction[]);

  return (
    <motion.div
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Toggle */}
        <button onClick={onToggle} className="shrink-0 transition-opacity hover:opacity-70">
          {playbook.enabled
            ? <ToggleRight className="h-5 w-5" style={{ color: "var(--accent)" }} />
            : <ToggleLeft className="h-5 w-5" style={{ color: "var(--fg-4)" }} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium" style={{ color: playbook.enabled ? "var(--fg-1)" : "var(--fg-3)" }}>
              {playbook.name}
            </p>
            {/* Trigger badge */}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: `color-mix(in srgb, ${trigger.color} 12%, transparent)`,
                color: trigger.color,
                border: `1px solid color-mix(in srgb, ${trigger.color} 25%, transparent)`,
              }}
            >
              {trigger.label}
            </span>
          </div>
          {playbook.description && (
            <p className="mt-0.5 text-[12px] truncate" style={{ color: "var(--fg-4)" }}>
              {playbook.description}
            </p>
          )}
        </div>

        {/* Actions summary */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {actions.slice(0, 3).map((a, i) => {
            const Icon = ACTION_ICONS[a.type];
            const meta = ACTION_META[a.type];
            return (
              <span key={i} className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "var(--overlay-md)" }} title={meta.label}>
                <Icon className="h-3 w-3" style={{ color: meta.color }} />
              </span>
            );
          })}
          {actions.length > 3 && (
            <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>+{actions.length - 3}</span>
          )}
        </div>

        {/* Last run */}
        {playbook.last_run_at && (
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: statusColor(playbook.last_run_status ?? "") }}
            />
            <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>
              {timeAgo(playbook.last_run_at)}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRun}
            disabled={running}
            title="Run now"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ background: "var(--overlay-md)" }}
          >
            {running
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--accent)" }} />
              : <Play className="h-3.5 w-3.5" style={{ color: "var(--fg-2)" }} />}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
            style={{ background: "var(--overlay-md)" }}
          >
            <Settings2 className="h-3.5 w-3.5" style={{ color: "var(--fg-2)" }} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            title="Expand"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
            style={{ background: "var(--overlay-md)" }}
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--fg-2)" }} />
              : <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--fg-2)" }} />}
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
            style={{ background: "var(--overlay-md)" }}
          >
            <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--rose)" }} />
          </button>
        </div>
      </div>

      {/* Expanded: actions detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0" style={{ borderTop: "1px solid var(--line)" }}>
              <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>
                Actions ({actions.length})
              </p>
              <div className="space-y-1.5">
                {actions.map((a, i) => {
                  const meta = ACTION_META[a.type];
                  const Icon = ACTION_ICONS[a.type];
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}>
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
                      <span className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>{meta.label}</span>
                      <span className="text-[11px] truncate" style={{ color: "var(--fg-4)" }}>{meta.description}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px]" style={{ color: "var(--fg-4)" }}>
                Runs: {playbook.run_count} total
                {playbook.last_run_at && ` · Last: ${timeAgo(playbook.last_run_at)}`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Run History ───────────────────────────────────────────────────────────────

function RunHistory({ runs }: { runs: PlaybookRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="py-12 text-center">
        <History className="mx-auto mb-3 h-8 w-8 opacity-20" style={{ color: "var(--fg-3)" }} />
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>No runs yet. Trigger a playbook to see history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run, i) => (
        <motion.div
          key={run.id}
          custom={i}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-xl p-4"
          style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: statusColor(run.status) }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>
                {(run as PlaybookRun & { playbook_name?: string }).playbook_name ?? "Playbook"}
              </p>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
                style={{ background: "var(--overlay-md)", color: "var(--fg-3)" }}
              >
                {run.triggered_by}
              </span>
            </div>
            <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>{timeAgo(run.started_at)}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--fg-4)" }}>
            <span style={{ color: statusColor(run.status) }} className="font-medium capitalize">{run.status}</span>
            <span>{run.actions_ok}/{run.actions_total} actions succeeded</span>
            {run.finished_at && (
              <span>{Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s</span>
            )}
          </div>
          {run.log && run.log.length > 0 && (
            <div className="mt-3 space-y-1">
              {run.log.map((entry, j) => (
                <div key={j} className="flex items-start gap-2 rounded-lg px-2 py-1.5 font-mono text-[11px]"
                  style={{ background: "var(--overlay-sm)" }}>
                  <span style={{ color: entry.status === "ok" ? "var(--emerald)" : entry.status === "failed" ? "var(--rose)" : "var(--fg-4)" }}>
                    {entry.status === "ok" ? "✓" : entry.status === "failed" ? "✗" : "–"}
                  </span>
                  <span style={{ color: "var(--fg-3)" }}>[{entry.action_type}]</span>
                  <span className="truncate" style={{ color: "var(--fg-2)" }}>{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "playbooks" | "schedules" | "notifications" | "runs";

export function AutomationsClient() {
  const [tab, setTab] = useState<Tab>("playbooks");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [runs, setRuns] = useState<PlaybookRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editTarget, setEditTarget] = useState<Playbook | null>(null);

  const loadPlaybooks = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/automations/playbooks");
    if (res.ok) {
      const d = await res.json() as { playbooks: Playbook[] };
      setPlaybooks(d.playbooks ?? []);
    }
    setLoading(false);
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/automations/runs?limit=30");
    if (res.ok) {
      const d = await res.json() as { runs: PlaybookRun[] };
      setRuns(d.runs ?? []);
    }
  }, []);

  useEffect(() => {
    void loadPlaybooks();
    void loadRuns();
  }, [loadPlaybooks, loadRuns]);

  const handleSave = async (data: Parameters<EditorProps["onSave"]>[0]) => {
    if (editTarget) {
      await fetch(`/api/automations/playbooks/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/automations/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setShowEditor(false);
    setEditTarget(null);
    await loadPlaybooks();
  };

  const handleToggle = async (pb: Playbook) => {
    await fetch(`/api/automations/playbooks/${pb.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !pb.enabled }),
    });
    setPlaybooks(prev => prev.map(p => p.id === pb.id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleRun = async (pb: Playbook) => {
    setRunningId(pb.id);
    await fetch(`/api/automations/playbooks/${pb.id}/run`, { method: "POST" });
    setRunningId(null);
    await Promise.all([loadPlaybooks(), loadRuns()]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this playbook?")) return;
    await fetch(`/api/automations/playbooks/${id}`, { method: "DELETE" });
    setPlaybooks(prev => prev.filter(p => p.id !== id));
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "playbooks",     label: "Playbooks",     icon: Zap },
    { key: "runs",          label: "Run history",   icon: History },
    { key: "schedules",     label: "Schedules",     icon: CalendarClock },
    { key: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
            Automations
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]" style={{ color: "var(--fg-1)" }}>
            Governance Playbooks
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fg-3)" }}>
            Automate governance responses — scan FAIL opens a fix PR, low trust score alerts Slack.
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowEditor(true); }}
          className="flex h-9 items-center gap-2 self-start rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus className="h-4 w-4" />
          New playbook
        </button>
      </motion.div>

      {/* Tabs */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium transition-all duration-200 sm:justify-start sm:px-3"
              style={tab === t.key
                ? { background: "var(--surface-1)", color: "var(--fg-1)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }
                : { color: "var(--fg-3)" }
              }
            >
              <t.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.key === "playbooks" && playbooks.length > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {playbooks.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === "playbooks" && (
          <motion.div
            key="playbooks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-xl shimmer" />
                ))}
              </div>
            ) : playbooks.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl"
                style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}>
                  <Zap className="h-6 w-6" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>No playbooks yet</p>
                  <p className="mt-1 max-w-xs text-[13px]" style={{ color: "var(--fg-3)" }}>
                    Create your first playbook to automate governance responses to scan events.
                  </p>
                </div>
                <button
                  onClick={() => { setEditTarget(null); setShowEditor(true); }}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  <Plus className="h-4 w-4" /> Create playbook
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {playbooks.map((pb, i) => (
                  <motion.div key={pb.id} custom={i} variants={fadeUp} initial="hidden" animate="show">
                    <PlaybookCard
                      playbook={pb}
                      onToggle={() => void handleToggle(pb)}
                      onRun={() => void handleRun(pb)}
                      onEdit={() => { setEditTarget(pb); setShowEditor(true); }}
                      onDelete={() => void handleDelete(pb.id)}
                      running={runningId === pb.id}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "runs" && (
          <motion.div
            key="runs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <RunHistory runs={runs} />
          </motion.div>
        )}

        {tab === "schedules" && (
          <motion.div
            key="schedules"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
          >
            <CalendarClock className="mx-auto mb-3 h-8 w-8 opacity-30" style={{ color: "var(--fg-3)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--fg-2)" }}>Scheduled scans</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--fg-4)" }}>Configure recurring scans in the Schedules page.</p>
            <a href="/schedules" className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--overlay-md)", color: "var(--fg-2)", border: "1px solid var(--line-2)" }}>
              <CalendarClock className="h-3.5 w-3.5" /> Go to Schedules
            </a>
          </motion.div>
        )}

        {tab === "notifications" && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
          >
            <Bell className="mx-auto mb-3 h-8 w-8 opacity-30" style={{ color: "var(--fg-3)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--fg-2)" }}>Alert destinations & rules</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--fg-4)" }}>Manage Slack, Discord, email, and webhook alert routing.</p>
            <a href="/alerts" className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--overlay-md)", color: "var(--fg-2)", border: "1px solid var(--line-2)" }}>
              <Bell className="h-3.5 w-3.5" /> Go to Alerts
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor modal */}
      <AnimatePresence>
        {showEditor && (
          <PlaybookEditor
            initial={editTarget}
            onSave={handleSave}
            onClose={() => { setShowEditor(false); setEditTarget(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
