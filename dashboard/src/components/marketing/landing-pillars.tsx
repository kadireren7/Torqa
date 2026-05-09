"use client";

import { motion, useReducedMotion } from "framer-motion";

const FEATURES = [
  {
    num: "01",
    label: "Scan",
    title: "Deterministic inspection",
    desc: "Every workflow JSON is parsed against a ruleset you control. No probabilistic scoring — exact rule IDs, exact line numbers.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/>
      </svg>
    ),
    preview: (
      <div className="mt-4 space-y-1.5 font-mono text-[11px]">
        {[
          { id: "v1.n8n.credential_in_env", sev: "HIGH",   sevColor: "var(--rose)" },
          { id: "v1.n8n.no_error_handler",  sev: "MEDIUM", sevColor: "var(--amber)" },
          { id: "v1.n8n.webhook_no_auth",   sev: "HIGH",   sevColor: "var(--rose)" },
        ].map(r => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-md px-2.5 py-1.5"
            style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
          >
            <span style={{ color: "var(--fg-3)" }}>{r.id}</span>
            <span style={{ color: r.sevColor }}>{r.sev}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "02",
    label: "Fix",
    title: "Auto-fix proposals",
    desc: "For every finding, Torqa generates a concrete fix. One click opens a draft PR or applies the change — human approval required.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
    preview: (
      <div className="mt-4 space-y-2">
        {[
          { rule: "credential_in_env", fix: "Move to vault reference", done: true },
          { rule: "no_error_handler",  fix: "Wrap node in try-catch",  done: false },
        ].map(f => (
          <div
            key={f.rule}
            className="rounded-md p-2.5"
            style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
          >
            <p className="font-mono text-[10px]" style={{ color: "var(--fg-4)" }}>{f.rule}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--fg-2)" }}>{f.fix}</p>
            <div className="mt-1.5">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold"
                style={{
                  color: f.done ? "var(--emerald)" : "var(--fg-3)",
                  background: f.done ? "color-mix(in srgb, var(--emerald) 10%, transparent)" : "var(--overlay-md)",
                }}
              >
                {f.done ? "APPLIED" : "PENDING"}
              </span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "03",
    label: "Govern",
    title: "Policies as gates",
    desc: "Compose strict, default, or custom policy packs. Enforce in CI, on schedule, or as a webhook gate before runs hit production.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    preview: (
      <div className="mt-4 space-y-1.5 font-mono text-[11px]">
        {[
          { name: "strict-v2",       rules: "14 rules", active: true },
          { name: "enterprise-soc2", rules: "22 rules", active: false },
          { name: "custom-dev",      rules: "8 rules",  active: false },
        ].map(p => (
          <div
            key={p.name}
            className="flex items-center justify-between rounded-md px-2.5 py-1.5"
            style={{
              border: `1px solid ${p.active ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--line)"}`,
              background: p.active ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--overlay-sm)",
            }}
          >
            <span style={{ color: p.active ? "var(--accent)" : "var(--fg-3)" }}>{p.name}</span>
            <span style={{ color: "var(--fg-4)" }}>{p.rules}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "04",
    label: "Audit",
    title: "Full decision history",
    desc: "Every scan, decision, fix, and approval is signed and timestamped. SOC 2 and ISO 27001 compliance reports generated on demand.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
    ),
    preview: (
      <div className="mt-4 space-y-1.5 font-mono text-[11px]">
        {[
          { action: "apply_fix",     ts: "2m ago",  color: "var(--emerald)" },
          { action: "scan_passed",   ts: "8m ago",  color: "var(--emerald)" },
          { action: "risk_accepted", ts: "1h ago",  color: "var(--amber)" },
          { action: "scan_blocked",  ts: "3h ago",  color: "var(--rose)" },
        ].map((e, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md px-2.5 py-1.5"
            style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: e.color }} />
              <span style={{ color: "var(--fg-3)" }}>{e.action}</span>
            </div>
            <span style={{ color: "var(--fg-4)" }}>{e.ts}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export function LandingPillars() {
  const reduce = useReducedMotion();

  return (
    <section
      id="features"
      className="px-5 py-24 sm:px-10 sm:py-36"
      style={{ background: "var(--surface-0)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <motion.div
          className="mb-16 max-w-[600px]"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
            Platform
          </p>
          <h2 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[44px]" style={{ color: "var(--fg-1)" }}>
            One system for the full lifecycle.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
            From raw workflow JSON to signed audit record — Torqa handles every step deterministically.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div
          className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2"
          style={{ background: "var(--line)" }}
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.num}
              className="p-8 transition-colors duration-200"
              style={{ background: "var(--surface-1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-1)"; }}
              initial={reduce ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, ease: [0.16,1,0.3,1], delay: i * 0.06 }}
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="font-mono text-[11px]" style={{ color: "var(--fg-4)" }}>{f.num}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ border: "1px solid var(--line-2)", background: "var(--overlay-sm)", color: "var(--fg-3)" }}
                >
                  {f.label}
                </span>
              </div>
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                  color: "var(--accent)",
                }}
              >
                {f.icon}
              </div>
              <h3 className="mb-2 text-[20px] font-semibold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
                {f.title}
              </h3>
              <p className="text-[14px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>{f.desc}</p>
              {f.preview}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
