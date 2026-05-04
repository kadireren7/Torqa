/**
 * Torqa v0.2.1 — Fix Engine.
 *
 * Maps a (rule_id, target, source, content) tuple to a deterministic FixProposal.
 * Every finding gets one proposal — at minimum, `manual_required` so the UI can
 * always offer an Accept-Risk path.
 *
 * Design rules:
 * - Pure & deterministic: same input → same patch. No randomness, no AI.
 * - Side-effect free: never mutates the workflow content; we only build patches.
 * - Conservative: if we are not 100% sure the patch preserves semantics, we
 *   downgrade to `structural` (preview only, requires approval) or
 *   `manual_required` (no patch).
 * - Re-uses the existing scan-engine's node-shape conventions for n8n.
 */

import type { ScanFinding, ScanSource } from "@/lib/scan-engine";
import { buildFindingSignatureForScan } from "@/lib/governance/finding-signature";
import { encodePointerSegment, readJsonPointer } from "@/lib/governance/json-patch";
import type { FixProposal, JsonPatchOp } from "@/lib/governance/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unwrapN8nDoc(data: unknown): Record<string, unknown> | null {
  if (!isObject(data)) return null;
  const inner = data.data;
  if (isObject(inner) && Array.isArray(inner.nodes)) return inner;
  return data;
}

/** Locate an n8n node by its "Name (id)" target string and return its array index in `nodes`. */
function locateN8nNodeIndex(content: unknown, target: string): {
  index: number;
  basePointer: string;
  node: Record<string, unknown>;
} | null {
  const doc = unwrapN8nDoc(content);
  if (!doc) return null;
  const nodes = doc.nodes;
  if (!Array.isArray(nodes)) return null;

  // Target shape from scan-engine: "Name (id)" — split conservatively
  const match = /^(.*) \(([^)]+)\)$/.exec(target);
  const expectId = match?.[2] ?? null;
  const expectName = match?.[1] ?? null;

  let index = -1;
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    if (!isObject(n)) continue;
    const id = typeof n.id === "string" ? n.id : "";
    const name = typeof n.name === "string" ? n.name : "";
    if (expectId && id === expectId) {
      index = i;
      break;
    }
    if (!expectId && expectName && name === expectName) {
      index = i;
      break;
    }
  }
  if (index < 0) return null;

  // Determine pointer prefix: workflows stored under `.data.nodes` vs root `.nodes`.
  const root = content as Record<string, unknown>;
  const usesDataWrap =
    isObject(root.data) && Array.isArray((root.data as Record<string, unknown>).nodes);
  const basePointer = usesDataWrap ? `/data/nodes/${index}` : `/nodes/${index}`;

  return { index, basePointer, node: nodes[index] as Record<string, unknown> };
}

type FixBuilder = (args: {
  finding: ScanFinding;
  source: ScanSource;
  content: unknown;
}) => Pick<FixProposal, "type" | "explanation" | "patch" | "preview"> | null;

/**
 * Per-rule deterministic builders. Add new rules here as the scan engine
 * grows. Returning null falls back to a generic manual_required proposal.
 */
const FIX_BUILDERS: Record<string, FixBuilder> = {
  // --- n8n: TLS verification disabled --------------------------------------
  "v1.http.tls_verification_disabled": ({ finding, content }) => {
    const located = locateN8nNodeIndex(content, finding.target);
    if (!located) return null;
    const params = isObject(located.node.parameters) ? located.node.parameters : {};
    const ops: JsonPatchOp[] = [];
    if (Object.prototype.hasOwnProperty.call(params, "allowUnauthorizedCerts")) {
      ops.push({
        op: "replace",
        path: `${located.basePointer}/parameters/allowUnauthorizedCerts`,
        value: false,
      });
    }
    if (Object.prototype.hasOwnProperty.call(params, "ignoreSSLIssues")) {
      ops.push({
        op: "replace",
        path: `${located.basePointer}/parameters/ignoreSSLIssues`,
        value: false,
      });
    }
    if (Object.prototype.hasOwnProperty.call(params, "rejectUnauthorized")) {
      ops.push({
        op: "replace",
        path: `${located.basePointer}/parameters/rejectUnauthorized`,
        value: true,
      });
    }
    if (ops.length === 0) return null;

    return {
      type: "safe_auto",
      explanation:
        "Re-enable TLS certificate validation by flipping the insecure SSL bypass flags back to safe defaults.",
      patch: ops,
      preview: {
        before: { ...params },
        after: {
          ...params,
          ...(Object.prototype.hasOwnProperty.call(params, "allowUnauthorizedCerts")
            ? { allowUnauthorizedCerts: false }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(params, "ignoreSSLIssues")
            ? { ignoreSSLIssues: false }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(params, "rejectUnauthorized")
            ? { rejectUnauthorized: true }
            : {}),
        },
      },
    };
  },

  // --- n8n: webhook with no auth ------------------------------------------
  "v1.webhook.public_no_auth": ({ finding, content }) => {
    const located = locateN8nNodeIndex(content, finding.target);
    if (!located) return null;
    const params = isObject(located.node.parameters) ? located.node.parameters : {};
    const before = { ...params };
    const after = { ...params, authentication: "headerAuth" };
    return {
      // Structural: turning auth on changes the runtime contract — must be
      // approved by a human even in autonomous mode.
      type: "structural",
      explanation:
        "Force the webhook to require header-based authentication. Operators must wire the auth credential before deploying.",
      patch: [
        {
          op: Object.prototype.hasOwnProperty.call(params, "authentication") ? "replace" : "add",
          path: `${located.basePointer}/parameters/authentication`,
          value: "headerAuth",
        },
      ],
      preview: { before, after },
    };
  },

  // --- n8n: HTTP node missing error handling ------------------------------
  "v1.http.missing_error_handling": ({ finding, content }) => {
    const located = locateN8nNodeIndex(content, finding.target);
    if (!located) return null;
    const params = isObject(located.node.parameters) ? located.node.parameters : {};
    const ops: JsonPatchOp[] = [
      {
        op: Object.prototype.hasOwnProperty.call(params, "continueOnFail") ? "replace" : "add",
        path: `${located.basePointer}/parameters/continueOnFail`,
        value: true,
      },
      {
        op: Object.prototype.hasOwnProperty.call(params, "retryOnFail") ? "replace" : "add",
        path: `${located.basePointer}/parameters/retryOnFail`,
        value: true,
      },
    ];
    return {
      type: "safe_auto",
      explanation:
        "Enable retry-on-fail and continue-on-fail so transient errors don't drop the whole run silently.",
      patch: ops,
      preview: {
        before: { ...params },
        after: { ...params, continueOnFail: true, retryOnFail: true },
      },
    };
  },

  // --- n8n: unused node (dead branch) --------------------------------------
  "v1.flow.unused_node": ({ finding, content }) => {
    const located = locateN8nNodeIndex(content, finding.target);
    if (!located) return null;
    return {
      type: "structural",
      explanation:
        "Disable the dead-end node so it cannot be re-enabled by accident. Removal is not auto-applied to preserve audit history.",
      patch: [
        {
          op: Object.prototype.hasOwnProperty.call(located.node, "disabled") ? "replace" : "add",
          path: `${located.basePointer}/disabled`,
          value: true,
        },
      ],
      preview: {
        before: { disabled: located.node.disabled === true },
        after: { disabled: true },
      },
    };
  },

  // --- GitHub Actions: write-all permissions -------------------------------
  "v1.github.permissions_write_all": ({ finding }) => {
    void finding;
    // We don't mutate raw YAML in v0.2.1 — surface a manual_required proposal
    // so the user fixes it inline in their repo. Auto-fix arrives in v0.2.2.
    return null;
  },

  // --- AI agent: prompt injection language --------------------------------
  "v1.agent.prompt_injection_risk": ({ finding, content }) => {
    if (!isObject(content)) return null;
    const prompt = typeof content.systemPrompt === "string" ? content.systemPrompt : null;
    if (!prompt) return null;
    const cleaned = prompt.replace(
      /\bignore (previous|above|all) (instructions?|context|prompt)\b/gi,
      "respect the constraints in this prompt"
    );
    if (cleaned === prompt) return null;
    return {
      type: "structural",
      explanation:
        "Replace prompt-injection-prone phrases in the system prompt with refusal-friendly equivalents.",
      patch: [{ op: "replace", path: "/systemPrompt", value: cleaned }],
      preview: { before: prompt, after: cleaned },
    };
    void finding;
  },

  // --- Generic: plaintext URL ---------------------------------------------
  "v1.generic.http_plaintext_url": ({ finding }) => {
    void finding;
    return null;
  },
};

const SAFE_GENERIC_HINT: Record<string, string> = {
  "v1.secret.plaintext_detected":
    "Move secrets to a credential manager / env var; rotate the leaked value before commit.",
  "v1.github.unpinned_action":
    "Pin the action to a full commit SHA. Dependabot can keep the SHA up to date safely.",
  "v1.github.pwn_request":
    "Either remove pull_request_target trigger or sandbox the PR head checkout off the privileged context.",
  "v1.complexity.large_workflow":
    "Split the workflow into smaller validated modules and add integration tests for critical branches.",
};

function genericManualProposal(finding: ScanFinding, signature: string): FixProposal {
  return {
    signature,
    severity: finding.severity,
    rule_id: finding.rule_id,
    target: finding.target,
    type: "manual_required",
    explanation:
      SAFE_GENERIC_HINT[finding.rule_id] ?? finding.suggested_fix ??
      "This finding requires manual remediation. Review the explanation and apply the change in source.",
    patch: [],
    preview: null,
  };
}

/**
 * Build a fix proposal for a single finding. Returns null when the rule has
 * an explicit no-op fix (we always wrap into manual_required at the caller).
 */
export function buildFixProposalForFinding(
  finding: ScanFinding,
  source: ScanSource,
  content: unknown
): FixProposal {
  const signature = buildFindingSignatureForScan(finding, source);
  const builder = FIX_BUILDERS[finding.rule_id];
  if (builder) {
    const built = builder({ finding, source, content });
    if (built) {
      return {
        signature,
        severity: finding.severity,
        rule_id: finding.rule_id,
        target: finding.target,
        ...built,
      };
    }
  }
  return genericManualProposal(finding, signature);
}

/** Re-export for tests/UI: read a JSON pointer without throwing. */
export const peekJsonPointer = readJsonPointer;

/** Re-export so callers can build pointer segments safely. */
export const encodeJsonPointerSegment = encodePointerSegment;
