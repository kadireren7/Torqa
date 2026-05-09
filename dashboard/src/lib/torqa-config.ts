/**
 * Compliance-as-Code — torqa.config.ts/json schema + validator
 * v0.4.0
 *
 * Usage: Place torqa.config.json in your repo root.
 * Run: POST /api/public/config-run with the config + workflow bundle.
 */

export type TorqaConfigSource = {
  type: "n8n" | "github" | "webhook" | "zapier" | "make" | "pipedream";
  url?: string;
  /** References env var name, not the actual secret */
  token_env?: string;
};

export type TorqaConfigReport = {
  /** Email recipients for scheduled reports */
  recipients?: string[];
  format?: "pdf" | "json" | "csv";
  /** Cron expression */
  schedule?: string;
};

export type TorqaConfigRule = {
  id: string;
  /** Override severity for this rule in this config */
  severity?: "info" | "review" | "high" | "critical";
  /** Disable this specific rule */
  disabled?: boolean;
};

export type TorqaConfig = {
  version: "1";
  /** Policy pack slug or "torqa-baseline" */
  policy: string;
  /** Allowed values: "pass" | "review" | "fail" — minimum gate level to fail CI */
  fail_on?: "pass" | "review" | "fail";
  sources?: TorqaConfigSource[];
  /** Override or disable individual rules */
  rules?: TorqaConfigRule[];
  report?: TorqaConfigReport;
  /** Optional tags for grouping runs */
  tags?: string[];
};

export type TorqaConfigValidationResult =
  | { valid: true; config: TorqaConfig }
  | { valid: false; errors: string[] };

/** Validate a parsed torqa.config.json object. */
export function validateTorqaConfig(raw: unknown): TorqaConfigValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Config must be a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.version !== "1") {
    errors.push(`"version" must be "1" (got ${JSON.stringify(obj.version)})`);
  }

  if (typeof obj.policy !== "string" || !obj.policy.trim()) {
    errors.push('"policy" must be a non-empty string (e.g. "torqa-baseline")');
  }

  const VALID_FAIL_ON = ["pass", "review", "fail"];
  if (obj.fail_on !== undefined && !VALID_FAIL_ON.includes(obj.fail_on as string)) {
    errors.push(`"fail_on" must be one of ${VALID_FAIL_ON.join(", ")}`);
  }

  if (obj.sources !== undefined) {
    if (!Array.isArray(obj.sources)) {
      errors.push('"sources" must be an array');
    } else {
      const VALID_TYPES = ["n8n", "github", "webhook", "zapier", "make", "pipedream"];
      for (let i = 0; i < obj.sources.length; i++) {
        const s = obj.sources[i] as Record<string, unknown>;
        if (!VALID_TYPES.includes(s.type as string)) {
          errors.push(`sources[${i}].type must be one of ${VALID_TYPES.join(", ")}`);
        }
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    config: obj as unknown as TorqaConfig,
  };
}

/** Resolve the fail_on gate level to an exit code. */
export function resolveExitCode(
  decision: "PASS" | "NEEDS REVIEW" | "FAIL",
  failOn: TorqaConfig["fail_on"] = "fail"
): number {
  if (failOn === "pass") {
    // Any non-pass result fails CI
    return decision === "PASS" ? 0 : 1;
  }
  if (failOn === "review") {
    return decision === "PASS" ? 0 : 1;
  }
  // Default: only FAIL triggers non-zero
  return decision === "FAIL" ? 1 : 0;
}

/** Generate a torqa.config.json template string. */
export function generateConfigTemplate(): string {
  const config: TorqaConfig = {
    version: "1",
    policy: "torqa-baseline",
    fail_on: "fail",
    sources: [
      { type: "n8n", url: "https://your-n8n.example.com", token_env: "N8N_API_KEY" },
    ],
    rules: [
      { id: "v1.n8n.credential_in_env", severity: "critical" },
    ],
    report: {
      recipients: ["security@your-org.com"],
      format: "pdf",
      schedule: "0 9 * * 1",
    },
    tags: ["production", "n8n"],
  };
  return JSON.stringify(config, null, 2);
}
