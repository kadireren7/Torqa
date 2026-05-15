"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const TOUR_KEY = "torqa-scan-tour-v1";

const STEPS = [
  {
    title: "Upload or paste your MCP config",
    body: "Drag in a .json file or paste your MCP server config into the input area. You can also load the unsafe demo to see findings right away.",
  },
  {
    title: "Run the deterministic scan",
    body: "Click 'Run scan' to analyze your config with Torqa's rule engine. No AI. No black-box scoring. Every finding maps to a specific rule.",
  },
  {
    title: "Fix issues and export",
    body: "Review each finding, apply guided fixes, then export a hardened config that's safe for your agents to use.",
  },
];

export function ScanOnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        setVisible(true);
      } else {
        setShowHelp(true);
      }
    } catch {
      // localStorage unavailable — skip tour
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // no-op
    }
    setVisible(false);
    setShowHelp(true);
  }

  function restart() {
    setStep(0);
    setVisible(true);
    setShowHelp(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  const current = STEPS[step];
  if (!current) return null;

  return (
    <>
      {visible && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[300px] rounded-2xl p-5 shadow-2xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-2)",
          }}
          role="dialog"
          aria-label={`Scan guide: step ${step + 1} of ${STEPS.length}`}
        >
          {/* Header row */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        i === step ? "var(--accent)" : "var(--overlay-md)",
                    }}
                    aria-hidden
                  />
                ))}
              </div>
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--fg-4)" }}
              >
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button
              onClick={dismiss}
              className="rounded p-0.5 transition-opacity hover:opacity-70"
              style={{ color: "var(--fg-4)" }}
              aria-label="Skip tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <p
            className="mb-1 text-[14px] font-semibold"
            style={{ color: "var(--fg-1)" }}
          >
            {current.title}
          </p>
          <p
            className="mb-4 text-[12px] leading-relaxed"
            style={{ color: "var(--fg-3)" }}
          >
            {current.body}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-[12px] transition-opacity hover:opacity-70"
              style={{ color: "var(--fg-4)" }}
            >
              Skip
            </button>
            <button
              onClick={next}
              className="rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {step < STEPS.length - 1 ? "Next" : "Got it"}
            </button>
          </div>
        </div>
      )}

      {/* Help restart button */}
      {showHelp && !visible && (
        <button
          onClick={restart}
          className="fixed bottom-6 right-6 z-50 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-80"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-2)",
            color: "var(--fg-3)",
          }}
          aria-label="Restart scan guide"
          title="Restart scan guide"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
