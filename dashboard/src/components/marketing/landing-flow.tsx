"use client";

import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Connect a source",
    desc: "Link your n8n instance, GitHub repo, or drop a webhook. Torqa starts pulling workflows immediately — no agents to install.",
    tag: "2 min setup",
  },
  {
    num: "02",
    title: "Scan & get fix proposals",
    desc: "Every workflow is scanned against your policy pack. Violations surface with trust scores, severity levels, and one-click fix proposals.",
    tag: "Deterministic",
  },
  {
    num: "03",
    title: "Enforce & audit",
    desc: "Approve fixes, block risky deploys, and export compliance reports. Every decision is signed and queryable via API.",
    tag: "SOC 2 ready",
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
            Live in minutes.
            <br />
            Governing in hours.
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative grid gap-10 md:grid-cols-3 md:gap-14">
          {/* Connector */}
          <div
            className="absolute left-0 right-0 top-[22px] hidden h-px md:block"
            style={{ background: "linear-gradient(90deg, transparent, var(--line-2) 20%, var(--line-2) 80%, transparent)" }}
            aria-hidden
          />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="relative"
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, ease: [0.16,1,0.3,1], delay: i * 0.1 }}
            >
              <div
                className="relative mb-6 flex h-11 w-11 items-center justify-center rounded-xl font-mono text-[13px] font-semibold"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line-2)",
                  color: "var(--fg-1)",
                  zIndex: 1,
                }}
              >
                {step.num}
              </div>
              <span
                className="mb-2 inline-block rounded-full px-2 py-0.5 font-mono text-[10px]"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--overlay-sm)",
                  color: "var(--fg-4)",
                }}
              >
                {step.tag}
              </span>
              <h3 className="mb-2 text-[18px] font-semibold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
                {step.title}
              </h3>
              <p className="text-[14px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
