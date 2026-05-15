"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { docsUrl, githubUrl } from "@/lib/marketing-content";

const DEMO_FINDINGS = [
  { label: "filesystem.write — unrestricted path access", severity: "critical" },
  { label: "shell.exec — no input validation", severity: "critical" },
  { label: "Hardcoded API key in tool env", severity: "critical" },
  { label: "Tool scope broader than declared intent", severity: "review" },
];

const SEV_COLORS: Record<string, string> = {
  critical: "var(--red, #ef4444)",
  review: "var(--amber, #f59e0b)",
};

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
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 20%, var(--surface-0) 75%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 blur-[80px]"
        style={{ background: "radial-gradient(ellipse, var(--accent-glow), transparent 60%)" }}
        aria-hidden
      />

      {/* Badge */}
      <motion.div
        className="relative mb-10 flex items-center gap-2 rounded-full px-3.5 py-1.5"
        style={{ border: "1px solid var(--line-2)", background: "var(--overlay-sm)" }}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--emerald)", boxShadow: "0 0 8px var(--emerald)" }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--fg-3)" }}>
          Public alpha · MCP + AI agent security
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        className="relative mb-6 max-w-[900px] text-center font-bold leading-[1.0] tracking-[-0.04em]"
        style={{ fontSize: "clamp(40px, 7vw, 84px)", color: "var(--fg-1)" }}
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.25 }}
      >
        Secure your{" "}
        <span style={{ color: "var(--accent)" }}>MCP servers</span>
        <br />
        before your agents use them.
      </motion.h1>

      {/* Sub */}
      <motion.p
        className="relative mb-10 max-w-[560px] text-center text-[16px] leading-[1.65]"
        style={{ color: "var(--fg-3)" }}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.4 }}
      >
        Torqa scans MCP tools, detects unsafe permissions, secrets, missing validation, and risky execution paths — then generates hardened configs with deterministic safe defaults.
      </motion.p>

      {/* CTAs */}
      <motion.div
        className="relative mb-4 flex flex-wrap justify-center gap-3"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.55 }}
      >
        <Link
          href="/scan"
          className="rounded-lg px-6 py-3 text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Scan MCP config
        </Link>
        <Link
          href="/scan?sample=unsafe_mcp&source=mcp"
          className="rounded-lg border px-6 py-3 text-[14px] font-medium transition-colors hover:opacity-80"
          style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
        >
          Try unsafe demo
        </Link>
      </motion.div>

      <motion.div
        className="relative mb-8 flex justify-center"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.62 }}
      >
        <Link
          href="/waitlist"
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{
            background: "var(--overlay-sm)",
            border: "1px solid var(--line-2)",
            color: "var(--fg-3)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }}
            aria-hidden
          />
          Join early access — get notified when accounts open
        </Link>
      </motion.div>

      <motion.div
        className="relative mb-14 flex flex-wrap items-center justify-center gap-2 text-[12px]"
        style={{ color: "var(--fg-4)" }}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.68 }}
      >
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
        >
          No external AI calls in the scan path. Deterministic. Local-first demo.
        </span>
        <a href={docsUrl} target="_blank" rel="noreferrer" className="hover:opacity-80 ml-2">
          Read docs
        </a>
        <span aria-hidden>·</span>
        <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
          GitHub
        </a>
      </motion.div>

      {/* Product preview */}
      <motion.div
        className="relative w-full max-w-[940px]"
        initial={reduce ? false : { opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.7 }}
      >
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
                torqa · mcp security scan
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)",
                background: "color-mix(in srgb, #ef4444 8%, transparent)",
              }}
            >
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: "#ef4444" }} />
              <span className="font-mono text-[10px]" style={{ color: "#ef4444" }}>RISK · 3 critical findings</span>
            </div>
          </div>

          {/* Two-panel */}
          <div
            className="grid grid-cols-1 gap-px md:grid-cols-[1fr_300px]"
            style={{ background: "var(--line)" }}
          >
            {/* Left — findings */}
            <div className="p-5" style={{ background: "var(--surface-1)" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Scan findings</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--fg-4)" }}>unsafe-mcp-server · 4 issues</span>
              </div>
              <div className="space-y-2">
                {DEMO_FINDINGS.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center justify-between rounded-lg px-3.5 py-2.5"
                    style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
                  >
                    <p className="min-w-0 truncate font-mono text-[11px]" style={{ color: "var(--fg-2)" }}>
                      {f.label}
                    </p>
                    <span
                      className="ml-3 shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase"
                      style={{
                        color: SEV_COLORS[f.severity],
                        background: `color-mix(in srgb, ${SEV_COLORS[f.severity]} 10%, transparent)`,
                      }}
                    >
                      {f.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — next actions */}
            <div className="p-5" style={{ background: "var(--surface-1)" }}>
              <div className="mb-3">
                <span className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>What you get</span>
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--fg-4)" }}>Deterministic report + fix guidance</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Risk score with rule-level breakdown", tone: "var(--emerald)" },
                  { label: "Fix guidance for each finding", tone: "var(--amber)" },
                  { label: "Re-scan to verify before/after score", tone: "var(--accent)" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg p-3"
                    style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.tone }} />
                      <p className="text-[11px] leading-relaxed" style={{ color: "var(--fg-3)" }}>{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 rounded-lg p-3 text-center"
                style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                  Connect a real MCP server or paste a config to start.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
