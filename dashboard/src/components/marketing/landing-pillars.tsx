"use client";

import { motion, useReducedMotion } from "framer-motion";

const FEATURES = [
  {
    num: "01",
    label: "Detect",
    title: "MCP tool inspection",
    desc: "Every tool in your MCP server config is parsed against a ruleset you control. Flags unrestricted write access, shell exec without validation, missing scope constraints, and more.",
    planned: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/>
      </svg>
    ),
    preview: (
      <div
        className="mt-4 rounded-md px-3 py-3 text-[11px] leading-relaxed font-mono"
        style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)", color: "var(--fg-4)" }}
      >
        <span style={{ color: "#ef4444" }}>CRITICAL</span> · filesystem.write · unrestricted path · rule MCP-001<br />
        <span style={{ color: "#ef4444" }}>CRITICAL</span> · shell.exec · no input validation · rule MCP-007
      </div>
    ),
  },
  {
    num: "02",
    label: "Ask",
    title: "Guided triage",
    desc: "Click any finding and Torqa asks targeted questions about your intended use — before suggesting a fix. No generic remediations that break your actual use case.",
    planned: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    preview: (
      <div
        className="mt-4 rounded-md px-3 py-3 text-[11px] leading-relaxed"
        style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)", color: "var(--fg-3)" }}
      >
        &ldquo;Does this tool need write access outside the project directory?&rdquo; — Torqa uses your answer to scope the fix correctly.
      </div>
    ),
  },
  {
    num: "03",
    label: "Fix",
    title: "Safe policy generation",
    desc: "Torqa generates a concrete fix plan based on your answers — tightened permissions, added input validation, or a scoped capability constraint. You approve before anything changes.",
    planned: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
    preview: (
      <div
        className="mt-4 rounded-md px-3 py-3 text-[11px] leading-relaxed font-mono"
        style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)", color: "var(--fg-4)" }}
      >
        <span style={{ color: "var(--emerald)" }}>+ allowed_paths: [&quot;/workspace&quot;]</span><br />
        <span style={{ color: "#ef4444" }}>- allowed_paths: &quot;*&quot;</span>
      </div>
    ),
  },
  {
    num: "04",
    label: "Verify",
    title: "Before / after risk score",
    desc: "Re-scan after applying a fix. Torqa confirms your risk score improved and no new findings were introduced. Full audit trail included.",
    planned: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    preview: (
      <div
        className="mt-4 rounded-md px-3 py-3 text-[11px] leading-relaxed"
        style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)", color: "var(--fg-3)" }}
      >
        Risk score 28 → 91 · 3 critical findings resolved · scan diff exportable.
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
            From risky config to verified fix.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
            Detect → Ask → Fix → Verify. Planned steps are marked — current scan and verify capabilities work today.
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
                {f.planned && (
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[10px]"
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
