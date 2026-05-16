import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { githubUrl } from "@/lib/marketing-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Torqa | Build MCP workflows from Claude",
  description:
    "Connect Torqa as an MCP server, describe an automation in Claude, and get a structured workflow plan with tools, steps, approvals, and exportable JSON.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Torqa | Build MCP workflows from Claude",
    description:
      "Connect Torqa as an MCP server, describe an automation in Claude, and get a structured workflow plan.",
    url: "/",
    type: "website",
  },
};

const HOW = [
  {
    step: "01",
    title: "Connect Torqa to Claude",
    body: "Run the local MCP server and add it to Claude Desktop or Claude Code.",
  },
  {
    step: "02",
    title: "Describe the workflow",
    body: "Ask Claude to create a workflow from a plain-English automation request.",
  },
  {
    step: "03",
    title: "Export the plan",
    body: "Torqa returns structured steps, tools, approvals, safety notes, and JSON.",
  },
];

const TOOLS = [
  { name: "discover_tools",              body: "List MCP tools from a config or provided inventory." },
  { name: "create_workflow_from_prompt", body: "Turn a plain-English request into a structured plan." },
  { name: "validate_workflow",           body: "Check plans for missing tools, approvals, and risks." },
  { name: "export_workflow",             body: "Export torqa.workflow.v1 JSON or a Claude prompt." },
  { name: "list_workflow_templates",     body: "Browse starter templates for common automations." },
];

const REAL = ["MCP stdio server", "Deterministic planning engine", "Web builder", "Validation", "Export JSON / Claude prompt", "Setup docs"];
const PLANNED = ["Live execution", "OAuth / live integrations", "Hosted cloud credits", "Workflow runtime"];

export default async function MarketingLandingPage() {
  const supabase = await createClient();
  let navUser: { email: string; displayName: string | null } | null = null;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      navUser = {
        email: user.email,
        displayName:
          (typeof meta?.full_name === "string" && meta.full_name) ||
          (typeof meta?.name === "string" && meta.name) ||
          null,
      };
    }
  }

  return (
    <div className="bg-background text-foreground">
      <LandingNavbar user={navUser} />

      <main id="main-content">
        {/* Hero */}
        <section className="px-5 pb-20 pt-36 text-center sm:px-10 sm:pt-44" style={{ background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[760px]">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--fg-4)" }}>
              MCP Workflow Agent
            </p>
            <h1
              className="mb-6 text-[44px] font-bold leading-[1.04] tracking-[-0.04em] sm:text-[64px]"
              style={{ color: "var(--fg-1)" }}
            >
              Build MCP workflows from Claude.
            </h1>
            <p className="mx-auto mb-10 max-w-[620px] text-[16px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
              Connect Torqa as an MCP server, describe an automation in Claude, and get a
              structured workflow plan with tools, steps, approvals, and exportable JSON.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/demo/mcp-workflow-builder"
                className="rounded-lg px-7 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Try web builder
              </Link>
              <a
                href={`${githubUrl}/blob/main/docs/MCP_SERVER.md`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-7 py-3.5 text-[14px] font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Read MCP setup
              </a>
            </div>
            <p className="mt-6 font-mono text-[11px]" style={{ color: "var(--fg-4)" }}>
              Open source · Planning implemented · Live execution planned
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[1000px]">
            <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              How it works
            </p>
            <h2 className="mb-12 text-center text-[32px] font-bold tracking-[-0.03em] sm:text-[40px]" style={{ color: "var(--fg-1)" }}>
              Three steps to a workflow plan
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {HOW.map(({ step, title, body }) => (
                <div
                  key={step}
                  className="rounded-xl p-6"
                  style={{ background: "var(--surface-0)", border: "1px solid var(--line)" }}
                >
                  <p className="mb-3 font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>{step}</p>
                  <p className="mb-2 text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>{title}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-3)" }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MCP tools */}
        <section id="tools" className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              What Torqa exposes to Claude
            </p>
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              MCP tools
            </h2>
            <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
              {TOOLS.map((t, i) => (
                <div
                  key={t.name}
                  className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
                  style={{
                    background: "var(--surface-1)",
                    borderTop: i === 0 ? undefined : "1px solid var(--line)",
                  }}
                >
                  <code className="min-w-[220px] font-mono text-[12.5px]" style={{ color: "var(--accent)" }}>
                    {t.name}
                  </code>
                  <span className="text-[13px]" style={{ color: "var(--fg-3)" }}>{t.body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example workflow */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              Example
            </p>
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              A real workflow plan
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface-0)", border: "1px solid var(--line)" }}
              >
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Prompt</p>
                <p className="text-[14px] leading-[1.65]" style={{ color: "var(--fg-2)" }}>
                  “Create a workflow that reads urgent customer emails, notifies Slack, and drafts replies.”
                </p>
              </div>
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface-0)", border: "1px solid var(--line)" }}
              >
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Output</p>
                <ul className="space-y-1.5 text-[13px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
                  <li>— Trigger: morning email triage</li>
                  <li>— Tools: gmail.search, slack.send_message, gmail.create_draft</li>
                  <li>— Approval: required before sending replies</li>
                  <li>— Export: torqa.workflow.v1 JSON</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* What is real */}
        <section className="border-t px-5 py-20 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              Honest status
            </p>
            <h2 className="mb-10 text-center text-[28px] font-bold tracking-[-0.03em] sm:text-[36px]" style={{ color: "var(--fg-1)" }}>
              What is real today
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

        {/* Open source CTA */}
        <section className="border-t px-5 py-24 text-center sm:px-10 sm:py-28" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[680px]">
            <h2 className="mb-5 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[44px]" style={{ color: "var(--fg-1)" }}>
              Open-source core
            </h2>
            <p className="mb-10 text-[15px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
              Torqa is open source. Run it locally, connect it to Claude, and inspect the
              workflow planning engine.
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
                href={`${githubUrl}/blob/main/docs/MCP_SERVER.md`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-6 py-3 text-[14px] font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Read setup docs
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
