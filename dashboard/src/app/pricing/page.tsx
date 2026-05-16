import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing | Torqa",
  description: "Run Torqa locally for free. Hosted credits are planned.",
  openGraph: {
    title: "Pricing — Torqa",
    description: "Free locally. Hosted credits planned.",
    url: "/pricing",
    type: "website",
  },
};

const TIERS = [
  {
    name: "Open-source local",
    price: "Free",
    priceNote: "Run anywhere",
    description: "Run Torqa locally and connect it to Claude. No account.",
    features: [
      "Run Torqa MCP server locally",
      "Deterministic workflow planning",
      "Validate plans before export",
      "Export JSON / Claude prompt",
      "Web workflow builder",
    ],
    cta: { label: "Use locally", href: "/mcp-server", accent: true },
    status: null as null | string,
    highlight: true,
  },
  {
    name: "Hosted Free",
    price: "Free",
    priceNote: "Planned",
    description: "A hosted account with starter credits and saved plans.",
    features: [
      "Starter credits",
      "Saved workflow plans",
      "Cloud history",
    ],
    cta: { label: "Join waitlist", href: "/waitlist", accent: false },
    status: "Planned",
    highlight: false,
  },
  {
    name: "Credit packs",
    price: "From $5",
    priceNote: "Planned",
    description: "Top up credits for hosted workflow generation and saved history.",
    features: [
      "$5 → 50 credits (Starter)",
      "$15 → 200 credits (Builder)",
      "$39 → 750 credits (Agency)",
      "Local MCP usage stays free",
    ],
    cta: { label: "Planned", href: "/credits", accent: false },
    status: "Planned",
    highlight: false,
  },
] as const;

export default async function PricingPage() {
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
        <section className="px-5 pb-12 pt-36 text-center sm:px-10 sm:pt-44" style={{ background: "var(--surface-0)" }}>
          <div className="mx-auto max-w-[640px]">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              Pricing
            </p>
            <h1 className="mb-5 text-[40px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[56px]" style={{ color: "var(--fg-1)" }}>
              Free locally.
              <br />
              Credits when hosted.
            </h1>
            <p className="text-[16px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
              Torqa is open source. Run it locally for free. Hosted Torqa Cloud will use credits
              for saved workflow plans, cloud history, and hosted MCP workflow generation.
            </p>
          </div>
        </section>

        <section className="px-5 pb-28 pt-6 sm:px-10" style={{ background: "var(--surface-0)" }}>
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="relative flex flex-col rounded-2xl"
                style={{
                  background: "var(--surface-1)",
                  border: tier.highlight
                    ? "1px solid color-mix(in srgb, var(--accent) 45%, transparent)"
                    : "1px solid var(--line-2)",
                }}
              >
                <div className="flex flex-1 flex-col gap-5 p-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--fg-1)" }}>
                        {tier.name}
                      </p>
                      {tier.status && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300">
                          {tier.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold tracking-tight" style={{ color: "var(--fg-1)" }}>
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

                  <ul className="flex-1 space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          style={{ color: tier.highlight ? "var(--accent)" : "var(--fg-4)" }}
                          aria-hidden
                        />
                        <span className="text-[13px] leading-snug" style={{ color: "var(--fg-2)" }}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    <Link
                      href={tier.cta.href}
                      className="block w-full rounded-lg py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90"
                      style={
                        tier.cta.accent
                          ? { background: "var(--accent)", color: "#fff" }
                          : { background: "var(--overlay-sm)", color: "var(--fg-2)", border: "1px solid var(--line-2)" }
                      }
                    >
                      {tier.cta.label}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t px-5 py-16 sm:px-10" style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[700px] space-y-6 text-center">
            <h2 className="text-[24px] font-bold tracking-tight sm:text-[32px]" style={{ color: "var(--fg-1)" }}>
              Honest status
            </h2>
            <p className="text-[14px] leading-[1.7]" style={{ color: "var(--fg-3)" }}>
              No checkout is live. No credits have shipped. Local Torqa is fully usable today —
              the hosted product (credits, cloud history, hosted generation) is planned.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/mcp-server"
                className="rounded-lg px-6 py-3 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Use locally
              </Link>
              <Link
                href="/waitlist"
                className="rounded-lg border px-6 py-3 text-[14px] font-medium transition-colors hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Join waitlist
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
