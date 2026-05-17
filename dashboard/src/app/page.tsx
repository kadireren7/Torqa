import type { Metadata } from "next";
import Link from "next/link";

const githubUrl = "https://github.com/kadireren7/Torqa";
const docsUrl = `${githubUrl}/tree/main/docs`;
const mcpSetupUrl = `${githubUrl}/blob/main/docs/MCP_SERVER.md`;

export const metadata: Metadata = {
  title: "Torqa — Local-first Visual MCP Workflow Builder for Claude",
  description:
    "Run Torqa locally, connect it to Claude as an MCP server, and turn plain-English automation requests into visual MCP workflow plans with tools, steps, approvals, safety notes, and exportable JSON.",
  alternates: { canonical: "/" },
};

const WHAT = [
  "Connects to Claude as a local MCP server",
  "Creates workflow plans from plain-English prompts",
  "Visualizes workflows as nodes and edges",
  "Exports JSON and Claude prompts",
  "Validates structure and missing tools",
];

const HOW = [
  { step: "01", title: "Run Torqa locally",       body: "Clone the repo and start the MCP stdio server." },
  { step: "02", title: "Connect Claude via MCP",  body: "Add Torqa to claude_desktop_config.json and restart Claude." },
  { step: "03", title: "Ask Claude to create",    body: "Describe an automation in plain English." },
  { step: "04", title: "Export the plan",         body: "Get structured JSON, a Claude prompt, or a visual graph." },
];

const REAL = [
  "MCP stdio server",
  "Deterministic planning engine",
  "Visual builder",
  "Validation",
  "JSON / Claude prompt export",
  "Smoke test command",
  "Docs and examples",
];

const PLANNED = [
  "Live execution",
  "OAuth / live MCP introspection",
  "External API calls (Gmail, Slack, …)",
  "Hosted version (maybe later)",
];

const ARCH = [
  "Claude / MCP client",
  "↓ MCP stdio",
  "Torqa MCP server",
  "↓",
  "Workflow planning engine",
  "↓",
  "Visual graph + JSON export",
];

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Minimal top bar */}
      <header
        className="sticky top-0 z-20 flex h-14 items-center justify-between border-b px-5 backdrop-blur sm:px-10"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface-0) 80%, transparent)" }}
      >
        <Link href="/" className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--fg-1)" }}>
          Torqa
        </Link>
        <nav className="flex items-center gap-5 text-[13px]" style={{ color: "var(--fg-3)" }}>
          <Link href="/builder" className="hover:opacity-80">Builder</Link>
          <a href={mcpSetupUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">MCP setup</a>
          <a href={docsUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">Docs</a>
          <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">GitHub</a>
        </nav>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="px-5 pb-20 pt-28 text-center sm:px-10 sm:pt-36" style={{ background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[820px]">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--fg-4)" }}>
              Open source · Local-first
            </p>
            <h1
              className="mb-6 text-[44px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[60px]"
              style={{ color: "var(--fg-1)" }}
            >
              Local-first Visual MCP Workflow Builder for Claude
            </h1>
            <p className="mx-auto mb-10 max-w-[660px] text-[16px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
              Run Torqa locally, connect it to Claude as an MCP server, and turn plain-English
              automation requests into visual MCP workflow plans with tools, steps, approvals,
              safety notes, and exportable JSON.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/builder"
                className="rounded-lg px-7 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Open web builder
              </Link>
              <a
                href={mcpSetupUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-7 py-3.5 text-[14px] font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Read setup docs
              </a>
            </div>
            <p className="mt-6 font-mono text-[11px]" style={{ color: "var(--fg-4)" }}>
              Open source · Runs locally · MCP server implemented · Execution planned
            </p>
          </div>
        </section>

        {/* What Torqa does */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[900px]">
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              What Torqa does
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {WHAT.map((w) => (
                <li
                  key={w}
                  className="rounded-xl px-5 py-4 text-[14px]"
                  style={{ background: "var(--surface-0)", border: "1px solid var(--line)", color: "var(--fg-2)" }}
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[1000px]">
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              How it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW.map(({ step, title, body }) => (
                <div
                  key={step}
                  className="rounded-xl p-5"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
                >
                  <p className="mb-2 font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>{step}</p>
                  <p className="mb-1.5 text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>{title}</p>
                  <p className="text-[12.5px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              Example
            </h2>
            <div
              className="mb-4 rounded-xl p-5"
              style={{ background: "var(--surface-0)", border: "1px solid var(--line)" }}
            >
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Prompt</p>
              <p className="text-[14px]" style={{ color: "var(--fg-2)" }}>
                “Create a workflow that reads urgent Gmail emails, notifies Slack, and drafts replies.”
              </p>
            </div>
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface-0)", border: "1px solid var(--line)" }}
            >
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Output</p>
              <p className="font-mono text-[13px] leading-[1.7]" style={{ color: "var(--fg-2)" }}>
                Trigger → Gmail Search → Classify Urgency → Slack Notify → Draft Reply → Approval
              </p>
            </div>
          </div>
        </section>

        {/* What works / planned */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[1000px]">
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              What works today
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
              >
                <p className="mb-3 text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>Implemented</p>
                <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--fg-3)" }}>
                  {REAL.map((r) => <li key={r}>— {r}</li>)}
                </ul>
              </div>
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
              >
                <p className="mb-3 text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>Planned</p>
                <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--fg-3)" }}>
                  {PLANNED.map((p) => <li key={p}>— {p}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[700px]">
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              Architecture
            </h2>
            <pre
              className="overflow-x-auto rounded-xl px-6 py-6 text-center font-mono text-[13px] leading-[1.9]"
              style={{ background: "var(--surface-0)", border: "1px solid var(--line)", color: "var(--fg-2)" }}
            >
{ARCH.join("\n")}
            </pre>
          </div>
        </section>

        {/* Open source CTA */}
        <section className="border-t px-5 py-24 text-center sm:px-10 sm:py-28" style={{ borderColor: "var(--line)", background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[680px]">
            <h2 className="mb-5 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[44px]" style={{ color: "var(--fg-1)" }}>
              Open source
            </h2>
            <p className="mb-10 text-[15px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
              Torqa is open source. Clone the repo, run it locally, and inspect the workflow planning engine.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-6 py-3 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                View on GitHub
              </a>
              <a
                href={`${githubUrl}/blob/main/README.md`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-6 py-3 text-[14px] font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Read README
              </a>
            </div>
          </div>
        </section>

        <footer
          className="border-t px-5 py-8 text-center text-[12px]"
          style={{ borderColor: "var(--line)", background: "var(--surface-1)", color: "var(--fg-4)" }}
        >
          Torqa · Open-source MCP workflow builder · AGPL v3
        </footer>
      </main>
    </div>
  );
}
