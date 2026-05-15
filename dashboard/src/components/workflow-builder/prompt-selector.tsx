"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { WorkflowPromptExample } from "@/lib/workflow-builder/types";

type Props = {
  examples: WorkflowPromptExample[];
  selectedId: string | null;
  onSelect: (promptOrId: string) => void;
};

export function PromptSelector({ examples, selectedId, onSelect }: Props) {
  const [custom, setCustom] = useState("");

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {examples.map((ex) => {
          const active = selectedId === ex.id;
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className="group relative rounded-xl px-4 py-3.5 text-left transition-all duration-150"
              style={{
                background: active ? "var(--overlay-md)" : "var(--surface-1)",
                border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <p
                className="text-[13px] font-semibold leading-snug"
                style={{ color: "var(--fg-1)" }}
              >
                {ex.label}
              </p>
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: "var(--fg-3)" }}
              >
                {ex.prompt}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ex.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background: "var(--overlay-md)",
                      color: "var(--fg-4)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Or describe your own task…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              onSelect(custom.trim());
              setCustom("");
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg px-3 text-[13px] outline-none transition-colors"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            color: "var(--fg-1)",
          }}
        />
        <button
          disabled={!custom.trim()}
          onClick={() => {
            if (custom.trim()) {
              onSelect(custom.trim());
              setCustom("");
            }
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </button>
      </div>
    </div>
  );
}
