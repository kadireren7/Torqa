import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Credits",
  description: "Hosted Torqa credits — planned. Local MCP server usage stays free.",
};

const PACKS = [
  { name: "Starter", price: "$5",  credits: "50 credits" },
  { name: "Builder", price: "$15", credits: "200 credits" },
  { name: "Agency",  price: "$39", credits: "750 credits" },
];

const USAGE = [
  { label: "Generate hosted workflow plan", cost: "1 credit" },
  { label: "Save workflow history",          cost: "Included" },
  { label: "Export JSON / Claude prompt",    cost: "Free" },
  { label: "Local MCP server usage",         cost: "Free" },
];

export default function CreditsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
            Hosted credits
          </h1>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            }}
          >
            Planned
          </span>
        </div>
        <p className="max-w-[640px] text-[14px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
          Torqa is open source and can run locally for free. Hosted Torqa Cloud will use
          credits for saved workflow plans, cloud history, and hosted MCP workflow generation.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Credit packs (planned)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PACKS.map((p) => (
            <div
              key={p.name}
              className="rounded-xl p-5"
              style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>{p.name}</p>
              <p className="mt-2 text-[24px] font-bold" style={{ color: "var(--fg-1)" }}>{p.price}</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--fg-4)" }}>{p.credits}</p>
              <div
                className="mt-4 w-full rounded-lg py-2 text-center text-[12px] font-medium"
                style={{
                  background: "var(--overlay-sm)",
                  color: "var(--fg-4)",
                  border: "1px solid var(--line)",
                }}
                aria-disabled="true"
              >
                Coming soon
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Credit usage (planned)</h2>
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
          {USAGE.map((u, i) => (
            <div
              key={u.label}
              className="flex items-center justify-between px-4 py-3 text-[13px]"
              style={{
                background: "var(--surface-1)",
                borderTop: i === 0 ? undefined : "1px solid var(--line)",
              }}
            >
              <span style={{ color: "var(--fg-2)" }}>{u.label}</span>
              <span style={{ color: "var(--fg-4)" }}>{u.cost}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="flex flex-wrap items-center gap-3 rounded-xl px-5 py-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        <p className="flex-1 min-w-[200px] text-[13px]" style={{ color: "var(--fg-3)" }}>
          No billing is live. Local usage is free.
        </p>
        <Link
          href="/waitlist"
          className="rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Join waitlist
        </Link>
      </section>
    </div>
  );
}
