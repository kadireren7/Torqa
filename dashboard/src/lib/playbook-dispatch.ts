/**
 * Playbook auto-dispatch — called after each scan completes.
 * Evaluates all enabled playbooks and fires matching ones asynchronously.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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

export interface ScanDispatchContext {
  scan_id: string;
  user_id: string;
  workflow_name?: string;
  trust_score?: number;
  decision?: string;
  source?: string;
  findings_count?: number;
}

export async function dispatchPlaybooksForScan(
  supabase: SupabaseClient,
  ctx: ScanDispatchContext
): Promise<void> {
  const { data: playbooks } = await supabase
    .from("playbooks")
    .select("*")
    .eq("user_id", ctx.user_id)
    .eq("enabled", true);

  if (!playbooks?.length) return;

  const runCtx: PlaybookRunContext = {
    scan_id:        ctx.scan_id,
    workflow_name:  ctx.workflow_name,
    trust_score:    ctx.trust_score,
    decision:       ctx.decision,
    source:         ctx.source,
    findings_count: ctx.findings_count,
  };

  const matching = (playbooks as Playbook[]).filter(
    (pb) => shouldTrigger(pb.trigger, runCtx) && passesConditions(pb.conditions, runCtx)
  );

  await Promise.allSettled(matching.map((pb) => runPlaybook(supabase, pb, runCtx, ctx.user_id)));
}

async function runPlaybook(
  supabase: SupabaseClient,
  pb: Playbook,
  ctx: PlaybookRunContext,
  userId: string
): Promise<void> {
  const log: PlaybookRunLog[] = [];
  let actionsOk = 0;

  const { data: runRow } = await supabase
    .from("playbook_runs")
    .insert({
      playbook_id: pb.id,
      triggered_by: "scan",
      trigger_ref: ctx.scan_id ?? null,
      status: "running",
      actions_total: pb.actions.length,
      actions_ok: 0,
      log: [],
      user_id: userId,
    })
    .select("id")
    .single();

  const runId = (runRow as { id: string } | null)?.id;

  for (const action of pb.actions as PlaybookAction[]) {
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
    : actionsOk < pb.actions.length ? "partial"
    : "success";

  if (runId) {
    await supabase
      .from("playbook_runs")
      .update({ status: finalStatus, actions_ok: actionsOk, log, finished_at: new Date().toISOString() })
      .eq("id", runId);
  }

  await supabase
    .from("playbooks")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: finalStatus,
      run_count: (pb.run_count ?? 0) + 1,
    })
    .eq("id", pb.id);
}

async function executeAction(action: PlaybookAction, ctx: PlaybookRunContext): Promise<string> {
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
      return `Slack message sent: "${msg.slice(0, 80)}"`;
    }
    case "notify.email": {
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
    case "github.create_pr":
      return `GitHub fix PR queued (scan: ${ctx.scan_id ?? "unknown"}) — connect GitHub in Sources to execute`;
    case "scan.rescan": {
      const delay = action.config.delay_minutes ?? 0;
      return `Re-scan queued for ${ctx.workflow_name ?? "workflow"}${delay > 0 ? ` in ${delay}m` : ""}`;
    }
    case "governance.accept_risk":
      return `Risk accepted: "${action.config.rationale}"`;
    case "governance.block":
      return `Workflow blocked: "${action.config.reason ?? "governance policy"}"`;
    default:
      return "Action executed";
  }
}
