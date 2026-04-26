"use client";

import { useCallback, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShareScanButtonProps = {
  scanId: string;
};

export function ShareScanButton({ scanId }: ShareScanButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createShare = useCallback(async () => {
    setError(null);
    setCopied(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/scans/${encodeURIComponent(scanId)}/share`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { shareUrl?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
        return;
      }
      if (typeof data.shareUrl !== "string" || !data.shareUrl) {
        setError("Invalid response from server.");
        return;
      }
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy link — check permissions or try again.");
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-start">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-2 border-amber-500/25 bg-amber-500/[0.06] shadow-sm hover:bg-amber-500/10"
        disabled={loading}
        onClick={() => void createShare()}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
        {loading ? "Creating…" : copied ? "Link copied" : "Share report"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
