"use client";

import { motion, useReducedMotion } from "framer-motion";

const STATS = [
  { value: "99.97%",  label: "Decision accuracy" },
  { value: "340ms",   label: "Median gate latency" },
  { value: "12,400+", label: "Active workflows" },
  { value: "2.1M",    label: "Decisions per month" },
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
                className="text-[36px] font-bold tracking-[-0.04em] sm:text-[44px]"
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
