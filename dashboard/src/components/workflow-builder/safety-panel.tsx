import { Shield, AlertTriangle, XCircle, CheckCircle2, Info } from "lucide-react";
import type { WorkflowRisk } from "@/lib/workflow-builder/types";
import Link from "next/link";

const LEVEL_STYLE = {
  low: { color: "var(--emerald)", label: "Low risk", icon: CheckCircle2 },
  medium: { color: "var(--amber)", label: "Medium risk", icon: AlertTriangle },
  high: { color: "var(--rose)", label: "High risk", icon: XCircle },
};

type Props = {
  risk: WorkflowRisk;
};

export function SafetyPanel({ risk }: Props) {
  const style = LEVEL_STYLE[risk.level];
  const Icon = style.icon;

  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-0">
        <Shield className="h-4 w-4" style={{ color: style.color }} />
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
          Safety layer
        </p>
        <span
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: `color-mix(in srgb, ${style.color} 12%, transparent)`,
            color: style.color,
            border: `1px solid color-mix(in srgb, ${style.color} 25%, transparent)`,
          }}
        >
          <Icon className="h-3 w-3" />
          {style.label}
        </span>
      </div>

      <div className="space-y-3 px-5 py-4">
        {risk.reasons.length > 0 && (
          <ul className="space-y-1.5">
            {risk.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <Info
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--fg-4)" }}
                />
                <span className="text-[12px]" style={{ color: "var(--fg-2)" }}>
                  {r}
                </span>
              </li>
            ))}
          </ul>
        )}

        {risk.requiresApproval && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5"
            style={{
              background: "color-mix(in srgb, var(--amber) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--amber) 20%, transparent)",
            }}
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--amber)" }}
            />
            <p className="text-[12px]" style={{ color: "var(--amber)" }}>
              One or more steps require human approval before execution.
            </p>
          </div>
        )}

        {risk.irreversibleSteps.length > 0 && (
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--fg-4)" }}
            >
              Irreversible steps
            </p>
            <ul className="mt-1 space-y-0.5">
              {risk.irreversibleSteps.map((s) => (
                <li
                  key={s}
                  className="text-[12px]"
                  style={{ color: "var(--rose)" }}
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {risk.missingTools.length > 0 && (
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--fg-4)" }}
            >
              Missing / unconnected tools
            </p>
            <ul className="mt-1 space-y-0.5">
              {risk.missingTools.map((t) => (
                <li
                  key={t}
                  className="text-[12px]"
                  style={{ color: "var(--fg-3)" }}
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {risk.excludedUnsafeTools.length > 0 && (
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--fg-4)" }}
            >
              Excluded unsafe tools
            </p>
            <ul className="mt-1 space-y-0.5">
              {risk.excludedUnsafeTools.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-1.5 text-[12px]"
                  style={{ color: "var(--rose)" }}
                >
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5"
          style={{
            background: "var(--overlay-sm)",
            border: "1px solid var(--line)",
          }}
        >
          <Shield
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--accent)" }}
          />
          <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
            Run a{" "}
            <Link
              href="/scan"
              className="font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--accent)" }}
            >
              MCP preflight scan
            </Link>{" "}
            to detect unsafe tools in your live config before building workflows.
          </p>
        </div>
      </div>
    </div>
  );
}
