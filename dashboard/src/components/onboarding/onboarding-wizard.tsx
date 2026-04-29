"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    id: "upload",
    title: "Upload workflow",
    body: "Start with a JSON export from n8n or another automation tool.",
    href: "/workflow-library",
    actionLabel: "Upload your workflow",
  },
  {
    id: "scan",
    title: "Run scan",
    body: "Run a deterministic scan to get risk score, policy status, and explainable findings.",
    href: "/scan",
    actionLabel: "Run scan",
  },
  {
    id: "review",
    title: "Review risk/policy",
    body: "Open scan history to inspect findings and policy outcomes.",
    href: "/scan/history",
    actionLabel: "Review report",
  },
  {
    id: "share",
    title: "Save/share report",
    body: "Keep a scan snapshot for team review and share a report when needed.",
    href: "/scan/history",
    actionLabel: "Open saved reports",
  },
  {
    id: "monitor",
    title: "Set schedule/alert",
    body: "Automate recurring scans and route high-risk outcomes to your team.",
    href: "/schedules",
    actionLabel: "Set schedule",
  },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted: () => void;
};

export function OnboardingWizard({ open, onOpenChange, onCompleted }: Props) {
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  if (!open) return null;

  const complete = async () => {
    setSaving(true);
    try {
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardCompleted: true }),
      });
      onOpenChange(false);
      onCompleted();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <Card
        className="relative max-h-[90vh] w-full max-w-lg overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
        aria-describedby="onboarding-wizard-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader className="border-b border-border/60 bg-muted/30 pr-12">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-widest">Welcome</span>
          </div>
          <CardTitle id="onboarding-wizard-title" className="text-xl">
            Torqa setup walkthrough
          </CardTitle>
          <CardDescription id="onboarding-wizard-desc">
            Step {idx + 1} of {STEPS.length} — follow the governance loop once; you can reopen any page later from the
            sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-base font-semibold text-foreground">{step.title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href={step.href} onClick={() => onOpenChange(false)}>
              {step.actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border/60 bg-muted/20">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {idx > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIdx((i) => i - 1)}>
                Back
              </Button>
            ) : null}
            {!isLast ? (
              <Button type="button" size="sm" onClick={() => setIdx((i) => i + 1)}>
                Next
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={saving} onClick={() => void complete()}>
                <Check className="mr-1 h-4 w-4" aria-hidden />
                {saving ? "Saving…" : "Finish"}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
