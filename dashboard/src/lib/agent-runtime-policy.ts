/**
 * Agent Runtime Policy Engine — v0.4.0
 * Real-time policy evaluation for autonomous AI agent events.
 * Deterministic — no ML, no probabilities.
 */

export type AgentEventType =
  | "tool_call"
  | "tool_result"
  | "message"
  | "cost_tick"
  | "context_read"
  | "file_write"
  | "network_request"
  | "policy_check";

export type AgentRuntimeDecision = "allow" | "block" | "review" | "log";

export type AgentEvent = {
  agent_id: string;
  session_id?: string;
  event_type: AgentEventType;
  payload: Record<string, unknown>;
};

export type AgentPolicyRule = {
  id: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  evaluate: (event: AgentEvent, context: AgentSessionContext) => AgentPolicyViolation | null;
};

export type AgentPolicyViolation = {
  rule_id: string;
  severity: "critical" | "high" | "medium" | "low";
  decision: AgentRuntimeDecision;
  explanation: string;
};

export type AgentSessionContext = {
  tool_call_count: number;
  total_cost_usd: number;
  domains_accessed: Set<string>;
  files_written: string[];
  session_start: number;
};

export type AgentRuntimeEvalResult = {
  decision: AgentRuntimeDecision;
  violations: AgentPolicyViolation[];
  risk_score: number;
  evaluated_rules: number;
};

/** Default runtime policy rules. */
export const AGENT_RUNTIME_RULES: AgentPolicyRule[] = [
  {
    id: "v1.agent.runtime.tool_budget_exceeded",
    description: "Agent exceeded maximum tool calls per session (50)",
    severity: "high",
    evaluate(event, ctx) {
      if (event.event_type !== "tool_call") return null;
      if (ctx.tool_call_count > 50) {
        return {
          rule_id: this.id,
          severity: "high",
          decision: "block",
          explanation: `Agent has made ${ctx.tool_call_count} tool calls this session. Limit is 50.`,
        };
      }
      return null;
    },
  },
  {
    id: "v1.agent.runtime.cost_limit_exceeded",
    description: "Agent session cost exceeded $5 USD",
    severity: "critical",
    evaluate(event, ctx) {
      if (event.event_type !== "cost_tick") return null;
      const cost = typeof event.payload.cost_usd === "number" ? event.payload.cost_usd : 0;
      if (ctx.total_cost_usd + cost > 5) {
        return {
          rule_id: this.id,
          severity: "critical",
          decision: "block",
          explanation: `Session cost $${(ctx.total_cost_usd + cost).toFixed(2)} exceeds $5 limit.`,
        };
      }
      return null;
    },
  },
  {
    id: "v1.agent.runtime.exfil_to_external",
    description: "Agent sending data to untrusted external domain",
    severity: "critical",
    evaluate(event) {
      if (event.event_type !== "network_request") return null;
      const url = typeof event.payload.url === "string" ? event.payload.url : "";
      const method = typeof event.payload.method === "string" ? event.payload.method.toUpperCase() : "GET";
      if (!url) return null;
      // Block POST/PUT/PATCH to external domains not in allow-list
      if (!["POST", "PUT", "PATCH"].includes(method)) return null;
      const TRUSTED = ["api.anthropic.com", "api.openai.com", "localhost", "127.0.0.1"];
      try {
        const hostname = new URL(url).hostname;
        if (!TRUSTED.some(t => hostname === t || hostname.endsWith("." + t))) {
          return {
            rule_id: this.id,
            severity: "critical",
            decision: "block",
            explanation: `Agent attempted ${method} to untrusted host: ${hostname}`,
          };
        }
      } catch { /* invalid url, skip */ }
      return null;
    },
  },
  {
    id: "v1.agent.runtime.sensitive_file_write",
    description: "Agent writing to sensitive system path",
    severity: "critical",
    evaluate(event) {
      if (event.event_type !== "file_write") return null;
      const path = typeof event.payload.path === "string" ? event.payload.path : "";
      const BLOCKED = ["/etc/", "/usr/", "/bin/", "/sbin/", "~/.ssh/", "~/.aws/", "/proc/", "/sys/"];
      for (const prefix of BLOCKED) {
        if (path.startsWith(prefix) || path.includes(prefix)) {
          return {
            rule_id: this.id,
            severity: "critical",
            decision: "block",
            explanation: `Agent attempted write to sensitive path: ${path}`,
          };
        }
      }
      return null;
    },
  },
  {
    id: "v1.agent.runtime.credential_in_output",
    description: "Agent output contains potential credential or secret",
    severity: "high",
    evaluate(event) {
      if (event.event_type !== "message" && event.event_type !== "tool_result") return null;
      const content = JSON.stringify(event.payload);
      const SECRET_PATTERNS = [
        /sk-[a-zA-Z0-9]{20,}/,          // OpenAI keys
        /AKIA[A-Z0-9]{16}/,              // AWS access keys
        /"token"\s*:\s*"[^"]{20,}"/i,   // generic token fields
        /bearer\s+[a-zA-Z0-9\-._~+/]{20,}/i,
      ];
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          return {
            rule_id: this.id,
            severity: "high",
            decision: "review",
            explanation: "Potential credential detected in agent output.",
          };
        }
      }
      return null;
    },
  },
  {
    id: "v1.agent.runtime.excessive_context_read",
    description: "Agent reading more than 100 files in one session",
    severity: "medium",
    evaluate(event, ctx) {
      if (event.event_type !== "context_read") return null;
      if (ctx.files_written.length + 100 < ctx.tool_call_count) {
        return {
          rule_id: this.id,
          severity: "medium",
          decision: "review",
          explanation: `Unusually high context reads detected (${ctx.tool_call_count} operations).`,
        };
      }
      return null;
    },
  },
  {
    id: "v1.agent.runtime.session_duration_exceeded",
    description: "Agent session running longer than 2 hours",
    severity: "medium",
    evaluate(event, ctx) {
      const elapsed = Date.now() - ctx.session_start;
      if (elapsed > 2 * 60 * 60 * 1000) {
        return {
          rule_id: this.id,
          severity: "medium",
          decision: "review",
          explanation: `Session running for ${Math.round(elapsed / 60000)} minutes.`,
        };
      }
      return null;
    },
  },
];

const DECISION_PRIORITY: Record<AgentRuntimeDecision, number> = {
  block: 3, review: 2, log: 1, allow: 0,
};

/** Evaluate a single agent event against all runtime rules. */
export function evaluateAgentEvent(
  event: AgentEvent,
  context: AgentSessionContext,
  rules: AgentPolicyRule[] = AGENT_RUNTIME_RULES
): AgentRuntimeEvalResult {
  const violations: AgentPolicyViolation[] = [];

  for (const rule of rules) {
    const v = rule.evaluate(event, context);
    if (v) violations.push(v);
  }

  let decision: AgentRuntimeDecision = "allow";
  for (const v of violations) {
    if (DECISION_PRIORITY[v.decision] > DECISION_PRIORITY[decision]) {
      decision = v.decision;
    }
  }

  const riskScore = violations.reduce((acc, v) => {
    const weights: Record<string, number> = { critical: 40, high: 20, medium: 10, low: 5 };
    return Math.min(100, acc + (weights[v.severity] ?? 5));
  }, 0);

  return { decision, violations, risk_score: riskScore, evaluated_rules: rules.length };
}

/** Build a fresh session context. */
export function createSessionContext(): AgentSessionContext {
  return {
    tool_call_count: 0,
    total_cost_usd: 0,
    domains_accessed: new Set(),
    files_written: [],
    session_start: Date.now(),
  };
}

/** Update context from an event (mutates in place for efficiency). */
export function updateSessionContext(ctx: AgentSessionContext, event: AgentEvent): void {
  if (event.event_type === "tool_call") ctx.tool_call_count++;
  if (event.event_type === "cost_tick" && typeof event.payload.cost_usd === "number") {
    ctx.total_cost_usd += event.payload.cost_usd;
  }
  if (event.event_type === "network_request" && typeof event.payload.url === "string") {
    try { ctx.domains_accessed.add(new URL(event.payload.url).hostname); } catch { /* skip */ }
  }
  if (event.event_type === "file_write" && typeof event.payload.path === "string") {
    ctx.files_written.push(event.payload.path);
  }
}
