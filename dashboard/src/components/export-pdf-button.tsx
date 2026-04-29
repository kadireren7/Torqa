"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  filename: string;
};

export function ExportPdfButton({ url, filename }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (res.status === 401) {
        setError("Sign in required.");
        return;
      }
      if (res.status === 403) {
        setError("Not allowed to export this scan.");
        return;
      }
      if (res.status === 404) {
        setError("Report not found.");
        return;
      }
      if (!res.ok) {
        setError(`Download failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [url, filename]);

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-2 border-border/80 bg-background/60 shadow-sm"
        disabled={loading}
        onClick={() => void onClick()}
        title="Download server-generated PDF"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
        {loading ? "Preparing…" : "Export PDF"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
