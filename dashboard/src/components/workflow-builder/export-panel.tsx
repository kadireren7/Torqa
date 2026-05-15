"use client";

import { useState } from "react";
import { Copy, Download, CheckCheck, Scan } from "lucide-react";
import Link from "next/link";
import type { WorkflowExport } from "@/lib/workflow-builder/types";

type Props = {
  exp: WorkflowExport;
  planId: string;
};

export function ExportPanel({ exp, planId }: Props) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  function copyJson() {
    navigator.clipboard.writeText(exp.workflowJson).catch(() => {});
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(exp.claudePrompt).catch(() => {});
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  function downloadJson() {
    const blob = new Blob([exp.workflowJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torqa-workflow-${planId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions = [
    {
      label: "Copy workflow JSON",
      sublabel: "Paste into your automation system",
      icon: copiedJson ? CheckCheck : Copy,
      onClick: copyJson,
      active: copiedJson,
    },
    {
      label: "Copy Claude prompt",
      sublabel: "Use in Claude or Cursor to implement",
      icon: copiedPrompt ? CheckCheck : Copy,
      onClick: copyPrompt,
      active: copiedPrompt,
    },
    {
      label: "Download workflow plan",
      sublabel: "Save as .json file",
      icon: Download,
      onClick: downloadJson,
      active: false,
    },
  ];

  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      <div className="px-5 pt-4 pb-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
          Export
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
          Take this plan into your tools.
        </p>
      </div>
      <div className="grid gap-2 px-5 py-4 sm:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex flex-col gap-1.5 rounded-xl p-3.5 text-left transition-all duration-150 hover:opacity-80"
              style={{
                background: action.active
                  ? "color-mix(in srgb, var(--emerald) 10%, transparent)"
                  : "var(--overlay-sm)",
                border: `1px solid ${action.active ? "color-mix(in srgb, var(--emerald) 25%, transparent)" : "var(--line)"}`,
              }}
            >
              <Icon
                className="h-4 w-4"
                style={{ color: action.active ? "var(--emerald)" : "var(--accent)" }}
              />
              <p
                className="text-[12px] font-semibold"
                style={{ color: action.active ? "var(--emerald)" : "var(--fg-1)" }}
              >
                {action.active ? "Copied!" : action.label}
              </p>
              <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                {action.sublabel}
              </p>
            </button>
          );
        })}
      </div>
      <div
        className="flex items-center gap-3 rounded-b-xl border-t px-5 py-3"
        style={{ borderColor: "var(--line)", background: "var(--overlay-sm)" }}
      >
        <Scan className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
        <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
          Before executing, run a preflight scan to verify your MCP tools are safe.
        </p>
        <Link
          href="/scan"
          className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Scan MCP tools
        </Link>
      </div>
    </div>
  );
}
