import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing | Torqa",
  description:
    "Start free with the local MCP scanner. Paid plans coming soon for teams that need more scan quota, cloud history, and continuous governance.",
  openGraph: {
    title: "Pricing — Torqa",
    description:
      "Free local demo. Paid plans coming soon. Scan MCP configs, enforce policies, and export hardened configs.",
    url: "/pricing",
    type: "website",
  },
};

const TIERS = [
  {
    name: "Local Demo",
    price: "Free",
    priceNote: "No account needed",
    description:
      "Try Torqa instantly in your browser. No signup, no data leaves your machine.",
    features: [
      "3 scans per day",
      "1 hardening session per day",
      "Local reports only (browser storage)",
      "MCP + AI agent scanning",
      "Fix guidance for each finding",
      "Unsafe MCP demo config included",
    ],
    cta: { label: "Get started free", href: "/scan", accent: true },
    comingSoon: false,
    highlight: true,
  },
  {
    name: "Free Account",
    price: "Free",
    priceNote: "Coming soon",
    description:
      "A free account with more scan quota and cloud-backed report history.",
    features: [
      "25 scans per month",
      "5 hardening sessions per month",
      "10 saved reports",
      "Cloud report history",
      "Source connections (GitHub, n8n)",
    ],
    cta: { label: "Coming soon", href: "#", accent: false },
    comingSoon: true,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    priceNote: "/ month · coming soon",
    description:
      "For developers and security teams that run continuous governance on their automation stack.",
    features: [
      "500 scans per month",
      "100 hardening sessions per month",
      "Full report history",
      "Patch export (GitHub PR generator)",
      "CI gate integration",
      "Policy packs",
      "Priority support",
    ],
    cta: { label: "Coming soon", href: "#", accent: false },
    comingSoon: true,
    highlight: false,
  },
  {
    name: "Team",
    price: "Custom",
    priceNote: "Contact us",
    description:
      "For organizations that need shared workspaces, audit logs, and enterprise policy management.",
    features: [
      "Unlimited scans",
      "Team workspace",
      "Shared policies and playbooks",
      "Audit logs",
      "SSO (OIDC)",
      "Compliance reports (SOC2, ISO 27001)",
      "Dedicated support",
    ],
    cta: { label: "Coming soon", href: "#", accent: false },
    comingSoon: true,
    highlight: false,
  },
] as const;

export default async function PricingPage() {
  const supabase = await createClient();
  let navUser: { email: string; displayName: string | null } | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        <section
          className="px-5 pb-16 pt-36 text-center sm:px-10 sm:pt-44"
          style={{ background: "var(--surface-0)" }}
        >
          <div className="mx-auto max-w-[640px]">
            <p
              className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em]"
              style={{ color: "var(--fg-4)" }}
            >
              Pricing
            </p>
            <h1
              className="mb-5 text-[40px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[56px]"
              style={{ color: "var(--fg-1)" }}
            >
              Start free.
              <br />
              Scale when ready.
            </h1>
            <p
              className="text-[16px] leading-[1.6]"
              style={{ color: "var(--fg-3)" }}
            >
              Torqa&apos;s local demo runs entirely in your browser — no account required.
              Paid tiers are coming soon for teams that need more scan quota and
              cloud-backed features.
            </p>
          </div>
        </section>

        {/* Pricing grid */}
        <section
          className="px-5 pb-28 pt-10 sm:px-10"
          style={{ background: "var(--surface-0)" }}
        >
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="relative flex flex-col rounded-2xl"
                style={{
                  background: "var(--surface-1)",
                  border: tier.highlight
                    ? "1px solid color-mix(in srgb, var(--accent) 45%, transparent)"
                    : "1px solid var(--line-2)",
                  boxShadow: tier.highlight
                    ? "0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent), 0 4px 24px -4px color-mix(in srgb, var(--accent) 20%, transparent)"
                    : undefined,
                }}
              >
                {tier.highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    Current plan
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-5 p-6">
                  {/* Header */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-[15px] font-semibold tracking-tight"
                        style={{ color: "var(--fg-1)" }}
                      >
                        {tier.name}
                      </p>
                      {tier.comingSoon && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300"
                        >
                          Coming soon
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-3xl font-bold tracking-tight"
                        style={{ color: "var(--fg-1)" }}
                      >
                        {tier.price}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--fg-4)" }}>
                        {tier.priceNote}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-3)" }}>
                      {tier.description}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="flex-1 space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          style={{ color: tier.highlight ? "var(--accent)" : "var(--fg-4)" }}
                          aria-hidden
                        />
                        <span
                          className="text-[13px] leading-snug"
                          style={{ color: "var(--fg-2)" }}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-auto pt-2">
                    {tier.comingSoon ? (
                      <div
                        className="w-full rounded-lg py-2.5 text-center text-[13px] font-medium"
                        style={{
                          background: "var(--overlay-sm)",
                          color: "var(--fg-4)",
                          border: "1px solid var(--line)",
                          cursor: "default",
                        }}
                        aria-disabled="true"
                      >
                        Coming soon
                      </div>
                    ) : (
                      <Link
                        href={tier.cta.href}
                        className="block w-full rounded-lg py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90"
                        style={
                          tier.cta.accent
                            ? { background: "var(--accent)", color: "#fff" }
                            : {
                                background: "var(--overlay-sm)",
                                color: "var(--fg-2)",
                                border: "1px solid var(--line-2)",
                              }
                        }
                      >
                        {tier.cta.label}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Early access banner */}
        <section
          className="px-5 pb-12 pt-0 sm:px-10"
          style={{ background: "var(--surface-0)" }}
        >
          <div
            className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 rounded-2xl px-8 py-8 text-center sm:flex-row sm:justify-between sm:text-left"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--line-2)",
            }}
          >
            <div className="space-y-1">
              <p
                className="text-[15px] font-semibold"
                style={{ color: "var(--fg-1)" }}
              >
                Paid plans coming soon
              </p>
              <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
                Join early access to get notified when accounts open and lock in
                a founding-user rate.
              </p>
            </div>
            <Link
              href="/waitlist"
              className="shrink-0 rounded-lg border px-5 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--accent)",
                borderColor: "var(--accent)",
                color: "#fff",
              }}
            >
              Join early access
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section
          className="border-t px-5 py-20 sm:px-10"
          style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}
        >
          <div className="mx-auto max-w-[700px] space-y-10">
            <div className="text-center">
              <h2
                className="text-[28px] font-bold tracking-tight sm:text-[36px]"
                style={{ color: "var(--fg-1)" }}
              >
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-6">
              {[
                {
                  q: "Is this really free?",
                  a: "Yes. The local demo runs entirely in your browser with no account needed. 3 scans per day, reset at midnight local time.",
                },
                {
                  q: "When will paid plans launch?",
                  a: "We're in public alpha. Paid plans are planned for the future. No timeline yet.",
                },
                {
                  q: "Is my MCP config sent to a server?",
                  a: "No. The scanner runs entirely in your browser session. No data leaves your device.",
                },
                {
                  q: "What happens after I hit the daily limit?",
                  a: "The limit resets at midnight local time. You can also reset the local demo counter manually from the scan page.",
                },
              ].map(({ q, a }) => (
                <div
                  key={q}
                  className="rounded-xl border p-5"
                  style={{ borderColor: "var(--line)", background: "var(--surface-0)" }}
                >
                  <p className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    {q}
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
                    {a}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-center text-[13px]" style={{ color: "var(--fg-4)" }}>
              Daily limits reset at midnight (local time). Paid tiers will remove limits
              and add cloud-backed features.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
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
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
