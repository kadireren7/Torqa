import { Target, Zap, Tag, Layers, AlertTriangle } from "lucide-react";
import type { WorkflowIntent } from "@/lib/workflow-builder/types";

type Props = {
  intent: WorkflowIntent;
};

const rows = [
  { key: "goal" as const, label: "Goal", icon: Target },
  { key: "trigger" as const, label: "Trigger", icon: Zap },
];

export function IntentPanel({ intent }: Props) {
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      <div className="px-5 pt-4 pb-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
          Detected intent
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {rows.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-start gap-3">
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--accent)" }}
            />
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--fg-4)" }}
              >
                {label}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--fg-2)" }}>
                {intent[key]}
              </p>
            </div>
          </div>
        ))}

        <div className="flex items-start gap-3">
          <Tag
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--accent)" }}
          />
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--fg-4)" }}
            >
              Entities
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {intent.entities.map((e) => (
                <span
                  key={e}
                  className="rounded-md px-2 py-0.5 text-[11px]"
                  style={{ background: "var(--overlay-md)", color: "var(--fg-2)" }}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Layers
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--accent)" }}
          />
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--fg-4)" }}
            >
              Required systems
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {intent.requiredSystems.map((s) => (
                <span
                  key={s}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--accent)",
                    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {intent.approvalSensitiveActions.length > 0 && (
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--amber)" }}
            />
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--fg-4)" }}
              >
                Approval-sensitive actions
              </p>
              <ul className="mt-1 space-y-0.5">
                {intent.approvalSensitiveActions.map((a) => (
                  <li
                    key={a}
                    className="text-[12px]"
                    style={{ color: "var(--amber)" }}
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
