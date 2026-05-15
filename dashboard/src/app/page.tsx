import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingPillars } from "@/components/marketing/landing-pillars";
import { LandingFlow } from "@/components/marketing/landing-flow";
import { LandingMetricsBand } from "@/components/marketing/landing-metrics-band";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { docsUrl, githubUrl } from "@/lib/marketing-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Torqa | Prompt-to-MCP Workflow Builder",
  description:
    "Turn prompts into MCP-powered workflows. Torqa maps required MCP tools, builds structured workflow plans with approval points, and exports plans your AI tools can use.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Torqa | Prompt-to-MCP Workflow Builder",
    description: "Describe what you want done. Torqa maps MCP tools, builds a workflow plan, and exports it for your AI agents.",
    url: "/",
    type: "website",
  },
};

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
        <MarketingHero />
        <LandingPillars />
        <LandingFlow />
        <LandingMetricsBand />

        {/* How it works — 3-step */}
        <section id="how" className="border-t border-border px-5 py-20 sm:px-10" style={{ background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              How it works
            </p>
            <h2 className="mb-12 text-center text-[32px] font-bold tracking-[-0.03em] sm:text-[40px]" style={{ color: "var(--fg-1)" }}>
              Three steps to a workflow plan
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { step: "01", title: "Describe the workflow", body: "Type a plain-English automation request. Torqa parses the intent, identifies required systems, and maps approval-sensitive actions." },
                { step: "02", title: "Torqa maps MCP tools and steps", body: "The engine selects MCP tools, builds ordered steps with conditions, fallbacks, and risk levels — all deterministically, no LLM calls." },
                { step: "03", title: "Export the workflow plan", body: "Copy structured JSON, a paste-ready Claude/Cursor prompt, or download the full plan. Simulated demo — real execution is planned." },
              ].map(({ step, title, body }) => (
                <div
                  key={step}
                  className="rounded-xl p-6"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
                >
                  <p className="mb-3 font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>{step}</p>
                  <p className="mb-2 text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>{title}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-3)" }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border px-5 py-28 text-center sm:px-10 sm:py-40" style={{ background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[700px]">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              Public alpha
            </p>
            <h2 className="mb-5 text-[40px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[56px]" style={{ color: "var(--fg-1)" }}>
              Build a workflow.
              <br />
              Ship with confidence.
            </h2>
            <p className="mb-10 text-[16px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
              Try the deterministic demo or scan your MCP tools before using them in generated workflows.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/demo/mcp-workflow-builder"
                className="rounded-lg px-7 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Build demo workflow
              </Link>
              <Link
                href="/scan"
                className="rounded-lg border px-7 py-3.5 text-[14px] font-medium transition-colors hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Scan MCP tools
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-[13px]" style={{ color: "var(--fg-4)" }}>
              <a href={docsUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
                Read docs
              </a>
              <span aria-hidden>·</span>
              <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
                GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
