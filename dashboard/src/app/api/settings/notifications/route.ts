import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/scan-notification-rules";

export const runtime = "nodejs";

function toApi(row: Record<string, unknown> | null) {
  if (!row) {
    return {
      emailAlerts: DEFAULT_NOTIFICATION_PREFS.emailAlerts,
      slackWebhookUrl: DEFAULT_NOTIFICATION_PREFS.slackWebhookUrl,
      alertOnFail: DEFAULT_NOTIFICATION_PREFS.alertOnFail,
      alertOnHighRisk: DEFAULT_NOTIFICATION_PREFS.alertOnHighRisk,
      highRiskThreshold: DEFAULT_NOTIFICATION_PREFS.highRiskThreshold,
    };
  }
  return {
    emailAlerts: Boolean(row.email_alerts),
    slackWebhookUrl:
      typeof row.slack_webhook_url === "string" && row.slack_webhook_url.trim()
        ? (row.slack_webhook_url as string).trim()
        : null,
    alertOnFail: row.alert_on_fail !== false,
    alertOnHighRisk: row.alert_on_high_risk !== false,
    highRiskThreshold:
      typeof row.high_risk_threshold === "number" && Number.isFinite(row.high_risk_threshold)
        ? Math.max(0, Math.min(100, Math.round(row.high_risk_threshold as number)))
        : DEFAULT_NOTIFICATION_PREFS.highRiskThreshold,
  };
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: toApi((data ?? null) as Record<string, unknown> | null) });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const cur = toApi((existing ?? null) as Record<string, unknown> | null);

  const emailAlerts = typeof b.emailAlerts === "boolean" ? b.emailAlerts : cur.emailAlerts;
  const slackWebhookUrl =
    b.slackWebhookUrl === null || b.slackWebhookUrl === ""
      ? null
      : typeof b.slackWebhookUrl === "string"
        ? b.slackWebhookUrl.trim().slice(0, 2048)
        : cur.slackWebhookUrl;
  const alertOnFail = typeof b.alertOnFail === "boolean" ? b.alertOnFail : cur.alertOnFail;
  const alertOnHighRisk = typeof b.alertOnHighRisk === "boolean" ? b.alertOnHighRisk : cur.alertOnHighRisk;
  let highRiskThreshold = cur.highRiskThreshold;
  if (typeof b.highRiskThreshold === "number" && Number.isFinite(b.highRiskThreshold)) {
    highRiskThreshold = Math.max(0, Math.min(100, Math.round(b.highRiskThreshold)));
  }

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      email_alerts: emailAlerts,
      slack_webhook_url: slackWebhookUrl,
      alert_on_fail: alertOnFail,
      alert_on_high_risk: alertOnHighRisk,
      high_risk_threshold: highRiskThreshold,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: {
      emailAlerts,
      slackWebhookUrl,
      alertOnFail,
      alertOnHighRisk,
      highRiskThreshold,
    },
  });
}
