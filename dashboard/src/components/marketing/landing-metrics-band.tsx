"use client";

import { motion, useReducedMotion } from "framer-motion";

const STATS = [
  { value: "30+", label: "Security rules checked per scan" },
  { value: "100%", label: "Deterministic — same input, same output" },
  { value: "8+", label: "Source types supported (MCP, n8n, GitHub…)" },
  { value: "0ms", label: "External AI calls in the scan path" },
];

export function LandingMetricsBand() {
  const reduce = useReducedMotion();

  return (
    <section
      id="metrics"
      className="px-5 py-20 sm:px-10"
      style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface-0)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        <div
          className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4"
          style={{ background: "var(--line)" }}
        >
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              className="px-8 py-10"
              style={{ background: "var(--surface-1)" }}
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
            >
              <p
                className="text-[24px] font-bold tracking-[-0.03em] sm:text-[30px]"
                style={{ color: "var(--fg-1)" }}
              >
                {s.value}
              </p>
              <p className="mt-2 text-[13px]" style={{ color: "var(--fg-4)" }}>{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
