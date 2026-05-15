import { Wrench, AlertTriangle, RotateCcw } from "lucide-react";
import type { McpToolDefinition } from "@/lib/workflow-builder/types";

const RISK_COLOR: Record<string, string> = {
  low: "var(--emerald)",
  medium: "var(--amber)",
  high: "var(--rose)",
};

type Props = {
  tools: McpToolDefinition[];
};

export function ToolChips({ tools }: Props) {
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-2 px-5 pt-4 pb-0">
        <Wrench className="h-4 w-4" style={{ color: "var(--accent)" }} />
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
          Available MCP tools
        </p>
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-4">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2"
            style={{
              background: "var(--overlay-sm)",
              border: "1px solid var(--line)",
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: RISK_COLOR[tool.riskLevel] }}
            />
            <code
              className="font-mono text-[12px] font-medium"
              style={{ color: "var(--fg-2)" }}
            >
              {tool.name}
            </code>
            {tool.irreversible && (
              <span title="Irreversible action">
                <RotateCcw className="h-3 w-3" style={{ color: "var(--rose)" }} />
              </span>
            )}
            {tool.riskLevel === "high" && (
              <span title="High risk">
                <AlertTriangle className="h-3 w-3" style={{ color: "var(--amber)" }} />
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="border-t px-5 py-2.5 text-[11px]" style={{ color: "var(--fg-4)", borderColor: "var(--line)" }}>
        <span
          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: "var(--emerald)" }}
        />
        low risk
        <span
          className="mx-2 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: "var(--amber)" }}
        />
        medium
        <span
          className="mx-2 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: "var(--rose)" }}
        />
        high · irreversible
      </p>
    </div>
  );
}
