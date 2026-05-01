"use client";

import {
  BadgeCheck,
  Cable,
  GitBranch,
  Plug,
  Plus,
  Puzzle,
  Webhook,
  Workflow,
  Zap,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderStatusBadge } from "@/components/provider-status-badge";
import { AuthTypeBadge } from "@/components/auth-type-badge";
import type { Connector } from "@/lib/connectors/types";

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  n8n: Workflow,
  github: GitBranch,
  webhook: Webhook,
  zapier: Zap,
  make: Puzzle,
  pipedream: Plug,
  "ai-agent": Bot,
};

const PROVIDER_COLORS: Record<string, string> = {
  n8n: "bg-orange-500/15 text-orange-400",
  github: "bg-neutral-500/20 text-neutral-300",
  webhook: "bg-cyan-500/15 text-cyan-400",
  zapier: "bg-orange-600/15 text-orange-500",
  make: "bg-purple-500/15 text-purple-400",
  pipedream: "bg-green-500/15 text-green-400",
  "ai-agent": "bg-violet-500/15 text-violet-400",
};

type Props = {
  connector: Connector;
  connected: boolean;
  canConnect: boolean;
  onConnect: () => void;
};

export function ProviderCard({ connector, connected, canConnect, onConnect }: Props) {
  const Icon = PROVIDER_ICONS[connector.id] ?? Cable;
  const colorClass = PROVIDER_COLORS[connector.id] ?? "bg-muted/30 text-muted-foreground";
  const isComingSoon = connector.status === "coming_soon";

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-card transition-all duration-150 ${
        isComingSoon
          ? "border-border/40 opacity-60"
          : connected
          ? "border-emerald-500/30 bg-emerald-500/[0.02] shadow-sm"
          : "border-border/60 hover:border-border hover:shadow-sm"
      }`}
    >
      {connected && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <BadgeCheck className="h-3 w-3" />
          Connected
        </div>
      )}

      <div className="flex items-start gap-4 p-5 pb-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-tight">{connector.name}</span>
            <ProviderStatusBadge status={connector.status} />
          </div>
          <AuthTypeBadge authType={connector.authType} />
        </div>
      </div>

      <p className="px-5 pb-4 text-xs leading-relaxed text-muted-foreground">
        {connector.description}
      </p>

      <div className="flex flex-wrap gap-1 px-5 pb-4">
        {connector.capabilities.map((cap) => (
          <span
            key={cap}
            className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {cap.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="mt-auto border-t border-border/40 px-5 py-3">
        {isComingSoon ? (
          <span className="text-xs text-muted-foreground">Coming soon</span>
        ) : canConnect && !connected ? (
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onConnect}>
            <Plus className="h-3 w-3" />
            Connect
          </Button>
        ) : canConnect && connected ? (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onConnect}>
            Add another
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Requires cloud mode</span>
        )}
      </div>
    </div>
  );
}
