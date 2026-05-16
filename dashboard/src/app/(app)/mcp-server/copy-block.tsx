"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="group relative overflow-hidden rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
    >
      <pre
        className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-[1.6]"
        style={{ color: "var(--fg-2)" }}
      >
        {value}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: "var(--overlay-md)",
          color: "var(--fg-2)",
          border: "1px solid var(--line-2)",
        }}
        aria-label="Copy"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
