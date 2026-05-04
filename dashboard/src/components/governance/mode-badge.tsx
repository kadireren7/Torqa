"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, MessageSquare, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_GOVERNANCE_MODE,
  type GovernanceMode,
  type GovernanceModeView,
} from "@/lib/governance/types";

const ICONS: Record<GovernanceMode, React.ReactNode> = {
  autonomous: <Zap className="h-3 w-3" aria-hidden />,
  supervised: <Eye className="h-3 w-3" aria-hidden />,
  interactive: <MessageSquare className="h-3 w-3" aria-hidden />,
};

const TONE: Record<GovernanceMode, string> = {
  autonomous: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  supervised: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  interactive: "border-violet-500/40 bg-violet-500/10 text-violet-200",
};

const LABEL: Record<GovernanceMode, string> = {
  autonomous: "Autonomous",
  supervised: "Supervised",
  interactive: "Interactive",
};

export function GovernanceModeBadge({ className }: { className?: string }) {
  const [view, setView] = useState<GovernanceModeView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/governance/mode", { credentials: "same-origin" });
        if (cancelled) return;
        if (!res.ok) {
          setView({
            mode: DEFAULT_GOVERNANCE_MODE,
            scope: "personal",
            canChange: false,
            organizationId: null,
          });
          return;
        }
        const data = (await res.json()) as { governance?: GovernanceModeView };
        if (cancelled) return;
        setView(data?.governance ?? null);
      } catch {
        /* swallow — badge degrades gracefully */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mode = view?.mode ?? DEFAULT_GOVERNANCE_MODE;

  return (
    <Link
      href="/settings/governance"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors hover:opacity-90",
        TONE[mode],
        className
      )}
      title="Governance mode"
    >
      {ICONS[mode]}
      <span>{LABEL[mode]}</span>
    </Link>
  );
}
