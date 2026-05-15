import { ArrowDown, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { WorkflowStep } from "@/lib/workflow-builder/types";

const RISK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "color-mix(in srgb, var(--emerald) 10%, transparent)", text: "var(--emerald)", label: "Low risk" },
  medium: { bg: "color-mix(in srgb, var(--amber) 10%, transparent)", text: "var(--amber)", label: "Medium risk" },
  high: { bg: "color-mix(in srgb, var(--rose) 10%, transparent)", text: "var(--rose)", label: "High risk" },
};

type Props = {
  steps: WorkflowStep[];
};

export function WorkflowSteps({ steps }: Props) {
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      <div className="px-5 pt-4 pb-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
          Workflow plan
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
          Generated steps — simulated, no live execution
        </p>
      </div>

      <div className="space-y-0 px-5 py-4">
        {steps.map((step, idx) => {
          const risk = RISK_STYLE[step.riskLevel];
          return (
            <div key={step.id}>
              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--overlay-sm)",
                  border: "1px solid var(--line)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                      style={{
                        background: "var(--overlay-md)",
                        color: "var(--accent)",
                        border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                      }}
                    >
                      {step.stepNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code
                          className="font-mono text-[12px] font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          {step.tool}
                        </code>
                        {step.approvalRequired && (
                          <span
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: "color-mix(in srgb, var(--amber) 12%, transparent)",
                              color: "var(--amber)",
                              border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
                            }}
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Approval required
                          </span>
                        )}
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: risk.bg, color: risk.text }}
                        >
                          {risk.label}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-[13px]"
                        style={{ color: "var(--fg-1)" }}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-3 grid gap-2 rounded-lg p-3 text-[12px]"
                  style={{
                    background: "var(--overlay-md)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="flex gap-2">
                    <span className="shrink-0 font-semibold" style={{ color: "var(--fg-4)" }}>
                      Input
                    </span>
                    <code className="font-mono" style={{ color: "var(--fg-2)" }}>
                      {step.inputSummary}
                    </code>
                  </div>
                  {step.condition && (
                    <div className="flex gap-2">
                      <span className="shrink-0 font-semibold" style={{ color: "var(--fg-4)" }}>
                        Condition
                      </span>
                      <span style={{ color: "var(--fg-2)" }}>{step.condition}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="shrink-0 font-semibold" style={{ color: "var(--fg-4)" }}>
                      Fallback
                    </span>
                    <span style={{ color: "var(--fg-3)" }}>{step.fallback}</span>
                  </div>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown
                    className="h-4 w-4"
                    style={{ color: "var(--fg-4)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center gap-2 rounded-b-xl border-t px-5 py-3"
        style={{
          borderColor: "var(--line)",
          background: "color-mix(in srgb, var(--emerald) 5%, transparent)",
        }}
      >
        <CheckCircle2
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--emerald)" }}
        />
        <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
          Plan generated deterministically — no external API calls, no live execution.
        </p>
        <span
          className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={{
            background: "color-mix(in srgb, var(--amber) 12%, transparent)",
            color: "var(--amber)",
            border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
          }}
        >
          Simulated
        </span>
      </div>
    </div>
  );
}
