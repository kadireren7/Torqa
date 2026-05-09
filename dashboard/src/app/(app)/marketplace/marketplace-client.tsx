"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, Download, CheckCircle2, Shield, Bot, GitBranch, Layers, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Pack = {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  category: string;
  rules_count: number;
  downloads: number;
  tags: string[];
  is_official: boolean;
  installed: boolean;
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  security: Shield,
  compliance: Layers,
  "ai-agents": Bot,
  "ci-cd": GitBranch,
  general: Star,
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "security", label: "Security" },
  { key: "compliance", label: "Compliance" },
  { key: "ai-agents", label: "AI Agents" },
  { key: "ci-cd", label: "CI/CD" },
  { key: "general", label: "General" },
];

function fmtDownloads(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function MarketplaceClient() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function load(cat: string, query: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat !== "all") params.set("category", cat);
    if (query) params.set("q", query);
    const res = await fetch(`/api/marketplace?${params}`);
    if (res.ok) {
      const data = await res.json() as { packs: Pack[] };
      setPacks(data.packs ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(category, q); }, [category, q]);

  async function toggleInstall(pack: Pack) {
    setInstalling(pack.id);
    const method = pack.installed ? "DELETE" : "POST";
    const res = await fetch(`/api/marketplace/install/${pack.id}`, { method });
    if (res.ok) {
      setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, installed: !p.installed } : p));
    }
    setInstalling(null);
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>
          Policy Marketplace
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--fg-3)" }}>
          Install governance packs to extend your policy engine.
        </p>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--fg-4)" }}
          />
          <input
            type="text"
            placeholder="Search packs…"
            value={q}
            onChange={e => startTransition(() => setQ(e.target.value))}
            className="w-full rounded-lg py-2 pl-9 pr-4 text-sm outline-none"
            style={{
              background: "var(--overlay-sm)",
              border: "1px solid var(--line)",
              color: "var(--fg-1)",
            }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                category === c.key
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--overlay-sm)", color: "var(--fg-2)", border: "1px solid var(--line)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shimmer rounded-xl h-44"
              style={{ background: "var(--overlay-sm)" }}
            />
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="py-24 text-center" style={{ color: "var(--fg-4)" }}>
          No packs found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map(pack => {
            const Icon = CATEGORY_ICONS[pack.category] ?? Star;
            const busy = installing === pack.id;
            return (
              <div
                key={pack.id}
                className="card-lift flex flex-col gap-3 rounded-xl p-5"
                style={{
                  background: "var(--overlay-sm)",
                  border: "1px solid var(--line)",
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)" }}
                    >
                      <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-tight" style={{ color: "var(--fg-1)" }}>
                        {pack.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--fg-4)" }}>
                        by {pack.author}
                        {pack.is_official && (
                          <span className="ml-1 rounded px-1 py-0.5 text-[10px]"
                            style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
                            Official
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => toggleInstall(pack)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity",
                      busy && "opacity-50 cursor-not-allowed"
                    )}
                    style={
                      pack.installed
                        ? { background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }
                        : { background: "var(--accent)", color: "#fff" }
                    }
                  >
                    {pack.installed
                      ? <><CheckCircle2 className="h-3 w-3" /> Installed</>
                      : <><Download className="h-3 w-3" /> Install</>}
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed" style={{ color: "var(--fg-3)" }}>
                  {pack.description}
                </p>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between text-xs" style={{ color: "var(--fg-4)" }}>
                  <span>{pack.rules_count} rules</span>
                  <span>{fmtDownloads(pack.downloads)} installs</span>
                </div>

                {/* Tags */}
                {pack.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {pack.tags.slice(0, 3).map(t => (
                      <span key={t} className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{ background: "var(--overlay-md)", color: "var(--fg-3)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
