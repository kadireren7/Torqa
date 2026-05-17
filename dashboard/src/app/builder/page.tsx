"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Cpu, Plug, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const githubUrl = "https://github.com/kadireren7/Torqa";
import {
  generateWorkflowPlan,
  buildWorkflowExport,
  PROMPT_EXAMPLES,
} from "@/lib/workflow-builder/mcp-workflow-builder";
import type { WorkflowPlan } from "@/lib/workflow-builder/types";
import { PromptSelector } from "@/components/workflow-builder/prompt-selector";
import { IntentPanel } from "@/components/workflow-builder/intent-panel";
import { ToolChips } from "@/components/workflow-builder/tool-chips";
import { WorkflowSteps } from "@/components/workflow-builder/workflow-steps";
import { SafetyPanel } from "@/components/workflow-builder/safety-panel";
import { ExportPanel } from "@/components/workflow-builder/export-panel";

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: EASE },
  },
};

export default function McpWorkflowBuilderPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plan, setPlan] = useState<WorkflowPlan | null>(null);

  const handleSelect = useCallback((promptOrId: string) => {
    const example = PROMPT_EXAMPLES.find(
      (e) => e.id === promptOrId || e.prompt === promptOrId
    );
    setSelectedId(example ? example.id : promptOrId);
    setPlan(generateWorkflowPlan(promptOrId));
  }, []);

  const exp = plan ? buildWorkflowExport(plan) : null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--surface-0)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse 60% 30% at 50% -5%, rgba(34,211,238,0.07) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b px-6"
        style={{ borderColor: "var(--line)", background: "var(--sidebar-bg)" }}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[14px] font-semibold"
          style={{ color: "var(--fg-1)" }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            }}
          >
            <Cpu className="h-4 w-4" style={{ color: "var(--accent)" }} />
          </div>
          Torqa
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${githubUrl}/blob/main/docs/MCP_SERVER.md`}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--overlay-md)",
              border: "1px solid var(--line-2)",
              color: "var(--fg-2)",
            }}
          >
            <Plug className="h-3.5 w-3.5" />
            MCP setup
          </a>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-6 py-10 sm:px-8">
        {/* Hero */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div
            className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            }}
          >
            <Sparkles className="h-3 w-3" />
            Visual MCP Workflow Builder
          </div>
          <h1
            className="text-[32px] font-bold tracking-[-0.04em] leading-tight sm:text-[40px]"
            style={{ color: "var(--fg-1)" }}
          >
            Build MCP workflows from Claude.
          </h1>
          <p
            className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed"
            style={{ color: "var(--fg-3)" }}
          >
            This is the same planning engine exposed through the Torqa MCP server. Describe a
            task in plain English and get tools, steps, conditions, approvals, and exportable JSON.
          </p>
          <p
            className="mt-2 text-[12px]"
            style={{ color: "var(--fg-4)" }}
          >
            Planning only — deterministic, no live Gmail/Slack execution. External execution is planned.
          </p>
        </motion.div>

        <motion.section
          className="mb-10 rounded-xl p-5"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45, ease: EASE }}
        >
          <motion.div className="mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
              Use from Claude
            </p>
          </motion.div>
          <ol
            className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed"
            style={{ color: "var(--fg-3)" }}
          >
            <li>Connect the Torqa MCP server in Claude Desktop or Claude Code.</li>
            <li>Ask Claude to create a workflow from your prompt.</li>
            <li>Claude calls <code className="font-mono text-[12px]">torqa.create_workflow_from_prompt</code>.</li>
            <li>Validate and export the plan with <code className="font-mono text-[12px]">torqa.export_workflow</code>.</li>
          </ol>
          <a
            href={`${githubUrl}/blob/main/docs/MCP_SERVER.md`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-[12px] font-medium hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            Read MCP server setup →
          </a>
        </motion.section>

        {/* Step 1 — Prompt selector */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: EASE }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              1
            </div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
              Choose or describe a task
            </p>
          </div>
          <PromptSelector
            examples={PROMPT_EXAMPLES}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </motion.section>

        {/* Generated plan */}
        <AnimatePresence mode="wait">
          {plan && exp && (
            <motion.div
              key={plan.id}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit="exit"
              className="space-y-6"
            >
              {/* Step 2 — Intent */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    2
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    Detected intent
                  </p>
                </div>
                <IntentPanel intent={plan.intent} />
              </section>

              {/* Step 3 — Tools */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    3
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    Available MCP tools
                  </p>
                </div>
                <ToolChips tools={plan.detectedTools} />
              </section>

              {/* Step 4 — Workflow plan */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    4
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    Generated workflow plan
                  </p>
                </div>
                <WorkflowSteps steps={plan.steps} />
              </section>

              {/* Step 5 — Safety */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    5
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    Safety layer
                  </p>
                </div>
                <SafetyPanel risk={plan.risk} />
              </section>

              {/* Step 6 — Export */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    6
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    Export
                  </p>
                </div>
                <ExportPanel exp={exp} planId={plan.id} />
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {!plan && (
          <motion.div
            className="flex flex-col items-center justify-center py-20 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              }}
            >
              <Sparkles className="h-6 w-6" style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[15px] font-medium" style={{ color: "var(--fg-2)" }}>
              Select a prompt above to generate your first workflow plan.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
