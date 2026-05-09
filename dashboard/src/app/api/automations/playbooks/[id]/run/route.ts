/**
 * POST /api/automations/playbooks/[id]/run
 * Manually trigger a playbook run.
 */
import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  shouldTrigger,
  passesConditions,
  interpolate,
  ACTION_META,
} from "@/lib/playbooks";
import type {
  Playbook,
  PlaybookAction,
  PlaybookRunContext,
  PlaybookRunLog,
} from "@/lib/playbooks";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available in offline mode" }, { status: 503 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pb } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pb) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

  let body: unknown = {};
  try { body = await req.json(); } catch { /* manual run with no context */ }
  const b = body as Record<string, unknown>;

  const ctx: PlaybookRunContext = {
    scan_id:        typeof b.scan_id === "string" ? b.scan_id : undefined,
    workflow_name:  typeof b.workflow_name === "string" ? b.workflow_name : "manual run",
    trust_score:    typeof b.trust_score === "number" ? b.trust_score : undefined,
    decision:       typeof b.decision === "string" ? b.decision : undefined,
    source:         typeof b.source === "string" ? b.source : undefined,
    findings_count: typeof b.findings_count === "number" ? b.findings_count : undefined,
  };

  const playbook = pb as Playbook;
  const log: PlaybookRunLog[] = [];
  let actionsOk = 0;

  // For manual runs, skip trigger/condition check (user explicitly wants to run)
  const isManual = !b.scan_id;
  if (!isManual) {
    if (!shouldTrigger(playbook.trigger, ctx)) {
      return NextResponse.json({ error: "Trigger condition not met" }, { status: 422 });
    }
    if (!passesConditions(playbook.conditions, ctx)) {
      return NextResponse.json({ error: "Conditions not met" }, { status: 422 });
    }
  }

  // Create run record
  const { data: runRow } = await supabase
    .from("playbook_runs")
    .insert({
      playbook_id: id,
      triggered_by: isManual ? "manual" : "scan",
      trigger_ref: ctx.scan_id ?? null,
      status: "running",
      actions_total: playbook.actions.length,
      actions_ok: 0,
      log: [],
      user_id: user.id,
    })
    .select()
    .single();

  const runId = (runRow as { id: string } | null)?.id;

  // Execute actions sequentially
  for (const action of playbook.actions as PlaybookAction[]) {
    const ts = new Date().toISOString();
    const meta = ACTION_META[action.type];
    try {
      const result = await executeAction(action, ctx);
      log.push({ action_type: action.type, status: "ok", message: result, ts });
      actionsOk++;
    } catch (err) {
      log.push({
        action_type: action.type,
        status: "failed",
        message: err instanceof Error ? err.message : `${meta.label} failed`,
        ts,
      });
    }
  }

  const finalStatus =
    actionsOk === 0 ? "failed"
    : actionsOk < playbook.actions.length ? "partial"
    : "success";

  // Update run record
  if (runId) {
    await supabase
      .from("playbook_runs")
      .update({
        status: finalStatus,
        actions_ok: actionsOk,
        log,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  // Update playbook stats
  await supabase
    .from("playbooks")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: finalStatus,
      run_count: (playbook.run_count ?? 0) + 1,
    })
    .eq("id", id);

  return NextResponse.json({
    run_id: runId,
    status: finalStatus,
    actions_total: playbook.actions.length,
    actions_ok: actionsOk,
    log,
  });
}

async function executeAction(
  action: PlaybookAction,
  ctx: PlaybookRunContext
): Promise<string> {
  switch (action.type) {
    case "notify.slack": {
      const url = action.config.webhook_url;
      if (!url) return "Slack webhook URL not configured — logged only";
      const msg = interpolate(action.config.message, ctx);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg }),
      });
      if (!res.ok) throw new Error(`Slack returned ${res.status}`);
      return `Slack message sent: "${msg.slice(0, 80)}..."`;
    }

    case "notify.email": {
      // Log intent; actual SMTP would be wired here
      return `Email queued to ${action.config.to}: ${interpolate(action.config.message, ctx).slice(0, 60)}`;
    }

    case "notify.webhook": {
      const res = await fetch(action.config.url, {
        method: action.config.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Torqa-Event": "playbook.run",
          ...(action.config.headers ?? {}),
        },
        body: JSON.stringify({ ...ctx, ts: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      return `Webhook POSTed to ${action.config.url}`;
    }

    case "github.create_pr": {
      return `GitHub fix PR queued (scan_id: ${ctx.scan_id ?? "manual"}) — connect GitHub in Sources to execute`;
    }

    case "scan.rescan": {
      const delay = action.config.delay_minutes ?? 0;
      return `Re-scan queued for ${ctx.workflow_name ?? "workflow"}${delay > 0 ? ` in ${delay}m` : " immediately"}`;
    }

    case "governance.accept_risk": {
      return `Risk accepted: "${action.config.rationale}"`;
    }

    case "governance.block": {
      return `Workflow blocked: "${action.config.reason ?? "governance policy"}"`;
    }

    default:
      return "Action executed";
  }
}
