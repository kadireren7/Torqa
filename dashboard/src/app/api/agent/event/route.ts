/**
 * POST /api/agent/event
 * Real-time agent runtime governance endpoint.
 * Receives an agent event, evaluates it against runtime policies,
 * and returns allow/block/review/log decision immediately.
 */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateAgentEvent,
  createSessionContext,
  updateSessionContext,
  AGENT_RUNTIME_RULES,
} from "@/lib/agent-runtime-policy";
import type { AgentEvent, AgentSessionContext } from "@/lib/agent-runtime-policy";

export const runtime = "nodejs";

// In-memory session contexts (per session_id). Production: use Redis/KV.
const SESSION_STORE = new Map<string, AgentSessionContext>();

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  let userId: string | null = null;
  let orgId: string | null = null;

  if (apiKey && isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("user_id, organization_id")
        .eq("key_hash", hashKey(apiKey))
        .eq("revoked", false)
        .maybeSingle();
      if (keyRow) {
        userId = keyRow.user_id as string;
        orgId = keyRow.organization_id as string ?? null;
      }
    }
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const event: AgentEvent = {
    agent_id: typeof b.agent_id === "string" ? b.agent_id : "unknown",
    session_id: typeof b.session_id === "string" ? b.session_id : undefined,
    event_type: (b.event_type as AgentEvent["event_type"]) ?? "tool_call",
    payload: (b.payload as Record<string, unknown>) ?? {},
  };

  // Get/create session context
  const sessionKey = event.session_id ?? event.agent_id;
  let ctx = SESSION_STORE.get(sessionKey);
  if (!ctx) {
    ctx = createSessionContext();
    SESSION_STORE.set(sessionKey, ctx);
  }

  // Evaluate before updating context (so counts reflect state at time of event)
  const result = evaluateAgentEvent(event, ctx, AGENT_RUNTIME_RULES);

  // Update context
  updateSessionContext(ctx, event);

  // Persist event + decision if Supabase available
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      await supabase.from("agent_runtime_events").insert({
        agent_id: event.agent_id,
        session_id: event.session_id ?? null,
        event_type: event.event_type,
        payload: event.payload,
        decision: result.decision,
        policy_rule_id: result.violations[0]?.rule_id ?? null,
        risk_score: result.risk_score,
        organization_id: orgId,
        user_id: userId,
      });
    }
  }

  // Clean up old sessions (>4h) to avoid memory leak
  if (SESSION_STORE.size > 1000) {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    for (const [key, c] of SESSION_STORE.entries()) {
      if (c.session_start < cutoff) SESSION_STORE.delete(key);
    }
  }

  return NextResponse.json({
    decision: result.decision,
    risk_score: result.risk_score,
    violations: result.violations,
    evaluated_rules: result.evaluated_rules,
    session: {
      tool_calls: ctx.tool_call_count,
      cost_usd: ctx.total_cost_usd,
      files_written: ctx.files_written.length,
    },
  });
}

function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}
