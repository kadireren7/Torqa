/**
 * POST /api/agent/policy/check
 * Synchronous pre-execution policy check for agent actions.
 * Use this BEFORE executing a tool/action to get allow/block decision.
 */
import { NextResponse } from "next/server";
import { evaluateAgentEvent, createSessionContext, AGENT_RUNTIME_RULES } from "@/lib/agent-runtime-policy";
import type { AgentEvent } from "@/lib/agent-runtime-policy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const event: AgentEvent = {
    agent_id: typeof b.agent_id === "string" ? b.agent_id : "unknown",
    session_id: typeof b.session_id === "string" ? b.session_id : undefined,
    event_type: (b.action_type as AgentEvent["event_type"]) ?? "tool_call",
    payload: (b.payload as Record<string, unknown>) ?? {},
  };

  // Use a minimal context from request body if provided
  const ctx = createSessionContext();
  if (typeof b.tool_call_count === "number") ctx.tool_call_count = b.tool_call_count;
  if (typeof b.cost_usd === "number") ctx.total_cost_usd = b.cost_usd;
  if (typeof b.session_start === "number") ctx.session_start = b.session_start;

  const result = evaluateAgentEvent(event, ctx, AGENT_RUNTIME_RULES);

  return NextResponse.json({
    allowed: result.decision === "allow" || result.decision === "log",
    decision: result.decision,
    risk_score: result.risk_score,
    violations: result.violations.map(v => ({
      rule_id: v.rule_id,
      severity: v.severity,
      explanation: v.explanation,
    })),
  });
}
