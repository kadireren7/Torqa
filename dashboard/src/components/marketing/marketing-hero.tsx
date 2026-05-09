"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const SCAN_ROWS = [
  { name: "billing_automation",  source: "n8n",     score: 91, status: "APPROVED", ok: true  },
  { name: "customer_support_v2", source: "n8n",     score: 68, status: "REVIEW",   ok: false },
  { name: "onboarding_flow",     source: "webhook", score: 88, status: "APPROVED", ok: true  },
  { name: "data_sync_prod",      source: "github",  score: 94, status: "APPROVED", ok: true  },
];

const FIX_ITEMS = [
  { rule: "credential_in_env", sev: "HIGH",   fix: "Move to vault reference" },
  { rule: "no_error_handler",  sev: "MEDIUM", fix: "Wrap node in try-catch" },
];

export function MarketingHero() {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-10 sm:pt-36"
      style={{ background: "var(--surface-0)" }}
    >
      {/* Grid bg */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px)," +
            "linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />
      {/* Fade grid edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 20%, var(--surface-0) 75%)",
        }}
        aria-hidden
      />
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 blur-[80px]"
        style={{ background: "radial-gradient(ellipse, var(--accent-glow), transparent 60%)" }}
        aria-hidden
      />

      {/* Live badge */}
      <motion.div
        className="relative mb-10 flex items-center gap-2 rounded-full px-3.5 py-1.5"
        style={{
          border: "1px solid var(--line-2)",
          background: "var(--overlay-sm)",
        }}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--emerald)", boxShadow: "0 0 8px var(--emerald)" }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--fg-3)" }}>
          Governing 12,408 workflows live
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        className="relative mb-6 max-w-[900px] text-center font-bold leading-[1.0] tracking-[-0.04em]"
        style={{ fontSize: "clamp(44px, 7.5vw, 88px)", color: "var(--fg-1)" }}
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.25 }}
      >
        Scan. Fix. Govern.
        <br />
        <span style={{ color: "var(--fg-3)" }}>Every automation.</span>
      </motion.h1>

      {/* Sub */}
      <motion.p
        className="relative mb-10 max-w-[520px] text-center text-[16px] leading-[1.65]"
        style={{ color: "var(--fg-3)" }}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.4 }}
      >
        Torqa inspects every workflow, proposes fixes for every finding, and enforces
        your policies — before anything reaches production.
      </motion.p>

      {/* CTAs */}
      <motion.div
        className="relative mb-16 flex flex-wrap justify-center gap-3"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.55 }}
      >
        <Link
          href="/login"
          className="rounded-lg px-6 py-3 text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Get started free
        </Link>
        <Link
          href="/demo/report"
          className="rounded-lg border px-6 py-3 text-[14px] font-medium transition-colors hover:opacity-80"
          style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
        >
          View live demo
        </Link>
      </motion.div>

      {/* Product preview */}
      <motion.div
        className="relative w-full max-w-[940px]"
        initial={reduce ? false : { opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.7 }}
      >
        {/* Card glow */}
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl blur-2xl"
          style={{ background: "radial-gradient(ellipse 60% 30% at 50% 0%, var(--accent-glow), transparent)" }}
          aria-hidden
        />

        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ border: "1px solid var(--line-2)", background: "var(--surface-1)" }}
        >
          {/* Window chrome */}
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--line)", background: "var(--overlay-sm)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--overlay-md)" }} />
                ))}
              </div>
              <span className="font-mono text-[11px]" style={{ color: "var(--fg-4)" }}>
                torqa · governance console
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                border: "1px solid color-mix(in srgb, var(--emerald) 25%, transparent)",
                background: "color-mix(in srgb, var(--emerald) 8%, transparent)",
              }}
            >
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--emerald)" }} />
              <span className="font-mono text-[10px]" style={{ color: "var(--emerald)" }}>LIVE · scanning</span>
            </div>
          </div>

          {/* Two-panel */}
          <div
            className="grid grid-cols-1 gap-px md:grid-cols-[1fr_300px]"
            style={{ background: "var(--line)" }}
          >
            {/* Left — scans */}
            <div className="p-5" style={{ background: "var(--surface-1)" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Recent scans</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--fg-4)" }}>4 workflows · 2 sources</span>
              </div>
              <div className="space-y-2">
                {SCAN_ROWS.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-lg px-3.5 py-2.5"
                    style={{
                      border: `1px solid ${row.ok ? "var(--line)" : "color-mix(in srgb, var(--rose) 20%, transparent)"}`,
                      background: row.ok ? "var(--overlay-sm)" : "color-mix(in srgb, var(--rose) 4%, transparent)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[12px]" style={{ color: "var(--fg-1)" }}>{row.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--fg-4)" }}>{row.source}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono tabular-nums text-[12px]" style={{ color: "var(--fg-3)" }}>{row.score}</span>
                      <span
                        className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase"
                        style={{
                          color: row.ok ? "var(--emerald)" : "var(--rose)",
                          background: row.ok
                            ? "color-mix(in srgb, var(--emerald) 10%, transparent)"
                            : "color-mix(in srgb, var(--rose) 10%, transparent)",
                        }}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — fix proposals */}
            <div className="p-5" style={{ background: "var(--surface-1)" }}>
              <div className="mb-3">
                <span className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Fix proposals</span>
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--fg-4)" }}>customer_support_v2</p>
              </div>
              <div className="space-y-2">
                {FIX_ITEMS.map((f) => (
                  <div
                    key={f.rule}
                    className="rounded-lg p-3"
                    style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                        style={{
                          color: f.sev === "HIGH" ? "var(--rose)" : "var(--amber)",
                          background: f.sev === "HIGH"
                            ? "color-mix(in srgb, var(--rose) 10%, transparent)"
                            : "color-mix(in srgb, var(--amber) 10%, transparent)",
                        }}
                      >
                        {f.sev}
                      </span>
                      <code className="font-mono text-[10px]" style={{ color: "var(--fg-3)" }}>{f.rule}</code>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>{f.fix}</p>
                    <button
                      className="mt-2 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors"
                      style={{ border: "1px solid var(--line-2)", color: "var(--fg-2)" }}
                    >
                      Apply fix →
                    </button>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 rounded-lg p-3 text-center"
                style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>1 more finding</p>
                <button className="mt-1 text-[11px] transition-colors" style={{ color: "var(--fg-3)" }}>
                  View all →
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
