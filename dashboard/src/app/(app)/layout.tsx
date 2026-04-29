import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { OnboardingWizardHost } from "@/components/onboarding/onboarding-wizard-host";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Torqa" },
  description: "Torqa workspace — scans, policies, schedules, and team insights.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <OnboardingWizardHost />
    </>
  );
}
