import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanPageClient } from "./scan-client";

export const metadata: Metadata = {
  title: "Scan MCP Tools",
  description:
    "Upload or paste your MCP server config. Torqa runs a deterministic preflight scan and guides you through fixing unsafe tools, exposed secrets, and risky permissions.",
  openGraph: {
    title: "Scan MCP Tools — Torqa",
    description:
      "Deterministic MCP tool preflight scanner. Detect unsafe tools, exposed secrets, and missing validation before using them in workflows.",
  },
};

function ScanFallback() {
  return (
    <div className="space-y-6 pb-12" aria-busy="true">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-72 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<ScanFallback />}>
      <ScanPageClient />
    </Suspense>
  );
}
