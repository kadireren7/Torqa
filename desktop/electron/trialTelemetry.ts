/**
 * P135: local-only trial telemetry and feedback files under Electron userData.
 * No network upload — see docs/P135_TRIAL_FEEDBACK.md.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const SCHEMA_V = 1;

/** Event types the renderer may record (allowlist — ignore unknown). */
export const TRIAL_EVENT_TYPES = new Set([
  "build_attempt",
  "build_success",
  "build_failure",
  "app_pipeline_attempt",
  "app_pipeline_success",
  "app_pipeline_failure",
  "generate_tq_attempt",
  "generate_tq_success",
  "generate_tq_failure",
  "validate_auto_repair_attempt",
  "preview_retry",
  "preview_embedded",
  "preview_external_browser",
  "comparison_panel_opened",
  "llm_retry_observed",
]);

let sessionId = "";

export function initTrialSession(): string {
  sessionId = randomUUID();
  return sessionId;
}

export function getTrialSessionId(): string {
  return sessionId;
}

function trialRoot(): string {
  return path.join(app.getPath("userData"), "trial-data");
}

export function eventsFilePath(): string {
  return path.join(trialRoot(), "session-events.ndjson");
}

export function feedbackDirPath(): string {
  return path.join(trialRoot(), "feedback");
}

export function getTrialTelemetryInfo(): {
  schema: number;
  sessionId: string;
  dataDirectory: string;
  eventsFile: string;
  feedbackDirectory: string;
} {
  if (!sessionId) initTrialSession();
  return {
    schema: SCHEMA_V,
    sessionId,
    dataDirectory: trialRoot(),
    eventsFile: eventsFilePath(),
    feedbackDirectory: feedbackDirPath(),
  };
}

function sanitizeDetail(raw: unknown): Record<string, string | number | boolean> | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 16) break;
    if (!/^[a-z][a-z0-9_]{0,32}$/i.test(k)) continue;
    if (typeof v === "string") {
      out[k] = v.length > 120 ? `${v.slice(0, 117)}...` : v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === "boolean") {
      out[k] = v;
    }
    n++;
  }
  return Object.keys(out).length ? out : undefined;
}

export function appendTrialEvent(payload: { type: string; detail?: Record<string, unknown> }): { ok: true } | { ok: false; error: string } {
  try {
    if (!sessionId) initTrialSession();
    const type = String(payload.type || "").trim();
    if (!TRIAL_EVENT_TYPES.has(type)) {
      return { ok: false, error: "Unknown event type" };
    }
    const detail = sanitizeDetail(payload.detail);
    const line = JSON.stringify({
      v: SCHEMA_V,
      ts: new Date().toISOString(),
      sessionId,
      type,
      ...(detail ? { detail } : {}),
    });
    const dir = trialRoot();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(eventsFilePath(), `${line}\n`, "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const FEEDBACK_USEFUL = new Set(["yes", "no", "skip"]);
const FEEDBACK_FAIL = new Set(["none", "build", "validation", "preview", "generation", "other"]);

export function saveTrialFeedback(body: {
  useful: string | null;
  failureCategory: string | null;
  comment: string | null;
}): { ok: true; path: string } | { ok: false; error: string } {
  try {
    if (!sessionId) initTrialSession();
    const usefulRaw = body.useful != null ? String(body.useful).toLowerCase() : "skip";
    const useful = FEEDBACK_USEFUL.has(usefulRaw) ? usefulRaw : "skip";
    const failRaw = body.failureCategory != null ? String(body.failureCategory).toLowerCase() : "none";
    const failureCategory = FEEDBACK_FAIL.has(failRaw) ? failRaw : "none";
    let comment = body.comment != null ? String(body.comment) : "";
    if (comment.length > 8000) comment = `${comment.slice(0, 7997)}...`;

    const dir = feedbackDirPath();
    fs.mkdirSync(dir, { recursive: true });
    const name = `feedback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const fp = path.join(dir, name);
    const payload = {
      v: SCHEMA_V,
      savedAt: new Date().toISOString(),
      sessionId,
      useful,
      failureCategory,
      comment: comment.trim() || null,
    };
    fs.writeFileSync(fp, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true, path: fp };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
