"use client";

import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Connect",
    desc: "Paste an MCP server config, upload a tool manifest, or link an AI agent definition. No agent execution — read-only inspection.",
    tag: "Source input",
    planned: false,
  },
  {
    num: "02",
    title: "Scan",
    desc: "Torqa parses tools, permissions, secrets, and risky capabilities deterministically. Same input always yields same findings.",
    tag: "Risk analysis",
    planned: false,
  },
  {
    num: "03",
    title: "Ask",
    desc: "Click a finding. Torqa asks guided questions about your intended behavior to understand the context before suggesting a fix.",
    tag: "Guided triage",
    planned: true,
  },
  {
    num: "04",
    title: "Fix",
    desc: "Torqa generates a safe policy and fix plan based on your answers. You stay in control — nothing is applied automatically.",
    tag: "Fix planning",
    planned: true,
  },
  {
    num: "05",
    title: "Patch",
    desc: "Get a concrete diff or config patch you can apply immediately to your MCP server or agent definition.",
    tag: "Patch generation",
    planned: true,
  },
  {
    num: "06",
    title: "Verify",
    desc: "Re-scan after applying the fix. Torqa confirms your risk score improved and no new findings were introduced.",
    tag: "Re-scan",
    planned: false,
  },
];

export function LandingFlow() {
  const reduce = useReducedMotion();

  return (
    <section
      id="how"
      className="px-5 py-24 sm:px-10 sm:py-36"
      style={{ borderTop: "1px solid var(--line)", background: "var(--surface-0)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <motion.div
          className="mb-16 max-w-[600px]"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
            How it works
          </p>
          <h2 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[44px]" style={{ color: "var(--fg-1)" }}>
            Connect → Scan → Ask
            <br />
            <span style={{ color: "var(--accent)" }}>Fix → Patch → Verify.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
            Steps 3–5 are in active development. Steps 1, 2, and 6 work today.
          </p>
        </motion.div>

        {/* Steps — 3-col, 2-row grid */}
        <div className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-3" style={{ background: "var(--line)" }}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="relative p-7"
              style={{ background: "var(--surface-1)" }}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, ease: [0.16,1,0.3,1], delay: i * 0.07 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg font-mono text-[13px] font-semibold"
                  style={{
                    background: step.planned ? "var(--overlay-sm)" : "var(--accent-soft)",
                    border: `1px solid ${step.planned ? "var(--line)" : "color-mix(in srgb, var(--accent) 25%, transparent)"}`,
                    color: step.planned ? "var(--fg-3)" : "var(--accent)",
                  }}
                >
                  {step.num}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px]"
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--overlay-sm)",
                    color: "var(--fg-4)",
                  }}
                >
                  {step.tag}
                </span>
                {step.planned && (
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px]"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--amber, #f59e0b) 30%, transparent)",
                      background: "color-mix(in srgb, var(--amber, #f59e0b) 8%, transparent)",
                      color: "var(--amber, #f59e0b)",
                    }}
                  >
                    planned
                  </span>
                )}
              </div>
              <h3 className="mb-2 text-[20px] font-semibold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
                {step.title}
              </h3>
              <p className="text-[13px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
