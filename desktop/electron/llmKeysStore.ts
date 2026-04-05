/**
 * P114: Optional API keys + preferred LLM provider (Electron userData).
 * Keys are encrypted with OS-backed safeStorage when available.
 */

import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

const KEYS_FILE = "torqa-llm-keys.enc";
const SETTINGS_FILE = "torqa-llm-settings.json";

export type LlmProviderId = "openai" | "anthropic" | "google";

type StoredKeys = Partial<Record<LlmProviderId, string>>;

function keysPath(): string {
  return path.join(app.getPath("userData"), KEYS_FILE);
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

function readKeysDecrypted(): StoredKeys {
  const p = keysPath();
  if (!fs.existsSync(p)) return {};
  try {
    const buf = fs.readFileSync(p);
    if (!safeStorage.isEncryptionAvailable()) return {};
    const json = safeStorage.decryptString(buf);
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return {};
    return o as StoredKeys;
  } catch {
    return {};
  }
}

export function loadMergedLlmProcessEnv(): Record<string, string> {
  const keys = readKeysDecrypted();
  const env: Record<string, string> = {};
  if (keys.openai?.trim()) env.OPENAI_API_KEY = keys.openai.trim();
  if (keys.anthropic?.trim()) env.ANTHROPIC_API_KEY = keys.anthropic.trim();
  if (keys.google?.trim()) env.GOOGLE_API_KEY = keys.google.trim();
  return env;
}

export function getLlmProvider(): LlmProviderId {
  try {
    const p = settingsPath();
    if (!fs.existsSync(p)) return "openai";
    const j = JSON.parse(fs.readFileSync(p, "utf8")) as { provider?: string };
    const pr = (j.provider || "openai").toLowerCase();
    if (pr === "anthropic" || pr === "google" || pr === "openai") return pr;
  } catch {
    /* ignore */
  }
  return "openai";
}

export function setLlmProvider(provider: LlmProviderId): void {
  const p = settingsPath();
  let cur: Record<string, unknown> = {};
  try {
    if (fs.existsSync(p)) cur = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    cur = {};
  }
  cur.provider = provider;
  fs.writeFileSync(p, JSON.stringify(cur, null, 2), "utf8");
}

export function setLlmApiKey(slot: LlmProviderId, value: string | null | undefined): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Secure storage is not available on this system. Set API keys via environment variables instead.",
    );
  }
  const cur = readKeysDecrypted();
  const next = { ...cur };
  const v = (value ?? "").trim();
  if (!v) delete next[slot];
  else next[slot] = v;
  const enc = safeStorage.encryptString(JSON.stringify(next));
  fs.writeFileSync(keysPath(), enc);
}

export function getLlmKeyPresence(): {
  provider: LlmProviderId;
  haveOpenAi: boolean;
  haveAnthropic: boolean;
  haveGoogle: boolean;
} {
  const k = readKeysDecrypted();
  const pe = (n: string) => Boolean(String(process.env[n] || "").trim());
  return {
    provider: getLlmProvider(),
    haveOpenAi: Boolean(k.openai?.trim()) || pe("OPENAI_API_KEY"),
    haveAnthropic: Boolean(k.anthropic?.trim()) || pe("ANTHROPIC_API_KEY"),
    haveGoogle: Boolean(k.google?.trim()) || pe("GOOGLE_API_KEY") || pe("GEMINI_API_KEY"),
  };
}
