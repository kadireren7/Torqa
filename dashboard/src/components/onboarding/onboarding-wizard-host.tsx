"use client";

import { useCallback, useEffect, useState } from "react";
import { hasPublicSupabaseUrl } from "@/lib/env";
import { OnboardingWizard } from "./onboarding-wizard";

export function OnboardingWizardHost() {
  const [open, setOpen] = useState(false);
  const cloud = hasPublicSupabaseUrl();

  const check = useCallback(async () => {
    if (!cloud) return;
    try {
      const res = await fetch("/api/onboarding/progress", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { wizardCompletedAt?: string | null; error?: string };
      if (j.error) return;
      if (!j.wizardCompletedAt) setOpen(true);
    } catch {
      /* ignore */
    }
  }, [cloud]);

  useEffect(() => {
    void check();
  }, [check]);

  if (!cloud) return null;

  return <OnboardingWizard open={open} onOpenChange={setOpen} onCompleted={() => setOpen(false)} />;
}
