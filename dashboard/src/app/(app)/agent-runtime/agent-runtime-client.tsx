"use client";

import { useState } from "react";
import { Bot, ShieldCheck, ShieldX, Eye, AlertTriangle, Zap, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Decision = "allow" | "block" | "review" | "log";

type Violation = {
  rule_id: string;
  severity: string;
  explanation: string;
};

type EventResult = {
  decision: Decision;
  risk_score: number;
  violations: Violation[];
  session: {
    tool_calls: number;
    cost_usd: number;
    files_written: number;
  };
};

const DECISION_STYLE: Record<Decision, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  allow:  { label: "Allowed",  color: "var(--emerald, #10b981)", bg: "color-mix(in srgb, #10b981 15%, transparent)", Icon: ShieldCheck },
  log:    { label: "Logged",   color: "var(--fg-3)",             bg: "var(--overlay-md)",                             Icon: Eye },
  review: { label: "Review",   color: "var(--amber, #f59e0b)",   bg: "color-mix(in srgb, #f59e0b 15%, transparent)", Icon: AlertTriangle },
  block:  { label: "Blocked",  color: "var(--rose, #f43f5e)",    bg: "color-mix(in srgb, #f43f5e 15%, transparent)", Icon: ShieldX },
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--rose, #f43f5e)",
  high:     "var(--amber, #f59e0b)",
  medium:   "var(--fg-2)",
  low:      "var(--fg-4)",
};

const EXAMPLE_EVENTS = [
  {
    label: "Credential in output",
    body: {
      agent_id: "agent-demo",
      event_type: "tool_result",
      payload: { content: "sk-proj-ABCDEFGHIJKLMNOP12345" },
    },
  },
  {
    label: "External POST",
    body: {
      agent_id: "agent-demo",
      event_type: "tool_call",
      payload: { tool: "http_request", method: "POST", url: "https://external-api.example.com/data" },
    },
  },
  {
    label: "Sensitive file write",
    body: {
      agent_id: "agent-demo",
      event_type: "tool_call",
      payload: { tool: "write_file", path: "/etc/passwd" },
    },
  },
  {
    label: "Normal tool call",
    body: {
      agent_id: "agent-demo",
      event_type: "tool_call",
      payload: { tool: "read_file", path: "/tmp/output.txt" },
    },
  },
];

export function AgentRuntimeClient() {
  const [result, setResult] = useState<EventResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawJson, setRawJson] = useState(JSON.stringify(EXAMPLE_EVENTS[0].body, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ label: string; decision: Decision; score: number }>>([]);

  async function runCheck(body: object, label?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/policy/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as EventResult;
      setResult(data);
      setHistory(prev => [
        { label: label ?? "Custom event", decision: data.decision, score: data.risk_score },
        ...prev.slice(0, 9),
      ]);
    } catch {
      setError("Request failed — is the server running?");
    }
    setLoading(false);
  }

  async function runRaw() {
    try {
      const body = JSON.parse(rawJson) as object;
      await runCheck(body);
    } catch {
      setError("Invalid JSON");
    }
  }

  const d = result ? DECISION_STYLE[result.decision] : null;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)" }}
        >
          <Bot className="h-5 w-5" style={{ color: "var(--accent)" }} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>Agent Runtime</h1>
          <p className="text-sm" style={{ color: "var(--fg-3)" }}>
            Real-time governance for AI agent actions. Evaluate events before execution.
          </p>
        </div>
      </div>

      {/* Rules overview */}
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>
          Active Policy Rules
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 text-xs">
          {[
            "Tool budget (>50 calls)",
            "Cost limit ($5 USD)",
            "External POST exfil",
            "Sensitive file write",
            "Credential in output",
            "Excessive context read",
            "Session duration (>2h)",
          ].map(rule => (
            <div key={rule} className="flex items-center gap-1.5" style={{ color: "var(--fg-2)" }}>
              <Zap className="h-3 w-3 flex-shrink-0" style={{ color: "var(--accent)" }} />
              {rule}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: input */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium" style={{ color: "var(--fg-2)" }}>Quick examples</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_EVENTS.map(ev => (
              <button
                key={ev.label}
                onClick={() => {
                  setRawJson(JSON.stringify(ev.body, null, 2));
                  runCheck(ev.body, ev.label);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: "var(--overlay-md)", color: "var(--fg-2)", border: "1px solid var(--line)" }}
              >
                {ev.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" style={{ color: "var(--fg-4)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--fg-2)" }}>Custom event JSON</p>
            </div>
            <textarea
              value={rawJson}
              onChange={e => setRawJson(e.target.value)}
              rows={10}
              className="w-full rounded-lg p-3 font-mono text-xs outline-none resize-none"
              style={{
                background: "var(--overlay-sm)",
                border: "1px solid var(--line)",
                color: "var(--fg-1)",
              }}
            />
            {error && (
              <p className="text-xs" style={{ color: "var(--rose, #f43f5e)" }}>{error}</p>
            )}
            <button
              onClick={runRaw}
              disabled={loading}
              className={cn(
                "rounded-lg py-2 text-sm font-medium transition-opacity",
                loading && "opacity-50 cursor-not-allowed"
              )}
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {loading ? "Evaluating…" : "Evaluate Event"}
            </button>
          </div>
        </div>

        {/* Right: result */}
        <div className="flex flex-col gap-4">
          {result && d ? (
            <>
              {/* Decision badge */}
              <div
                className="flex items-center gap-3 rounded-xl p-5"
                style={{ background: d.bg, border: `1px solid ${d.color}` }}
              >
                <d.Icon className="h-6 w-6" style={{ color: d.color }} />
                <div>
                  <p className="text-lg font-semibold" style={{ color: d.color }}>{d.label}</p>
                  <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                    Risk score: {result.risk_score} / 100
                  </p>
                </div>
              </div>

              {/* Session stats */}
              {result.session && (
                <div
                  className="grid grid-cols-3 gap-3 rounded-xl p-4"
                  style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
                >
                  {[
                    { label: "Tool calls", value: result.session.tool_calls },
                    { label: "Cost", value: `$${result.session.cost_usd.toFixed(4)}` },
                    { label: "Files written", value: result.session.files_written },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-semibold" style={{ color: "var(--fg-1)" }}>{s.value}</p>
                      <p className="text-xs" style={{ color: "var(--fg-4)" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Violations */}
              {result.violations.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>
                    Violations ({result.violations.length})
                  </p>
                  {result.violations.map((v, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3"
                      style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                          style={{
                            color: SEVERITY_COLOR[v.severity] ?? "var(--fg-3)",
                            background: "var(--overlay-md)",
                          }}
                        >
                          {v.severity}
                        </span>
                        <code className="text-xs" style={{ color: "var(--fg-2)" }}>{v.rule_id}</code>
                      </div>
                      <p className="text-xs" style={{ color: "var(--fg-3)" }}>{v.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg p-4 text-center text-xs" style={{ color: "var(--fg-4)", background: "var(--overlay-sm)", border: "1px solid var(--line)" }}>
                  No policy violations detected.
                </div>
              )}
            </>
          ) : (
            <div
              className="flex flex-1 items-center justify-center rounded-xl p-12 text-center"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)", minHeight: 280 }}
            >
              <div style={{ color: "var(--fg-4)" }}>
                <Bot className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm">Select an example or submit a custom event</p>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>
                Recent evaluations
              </p>
              {history.map((h, i) => {
                const s = DECISION_STYLE[h.decision];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
                  >
                    <span style={{ color: "var(--fg-2)" }}>{h.label}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--fg-4)" }}>score {h.score}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ color: s.color, background: s.bg }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
