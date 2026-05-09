import type { Metadata } from "next";
import { AutomationsClient } from "./automations-client";

export const metadata: Metadata = {
  title: "Automations",
  description: "Governance Playbooks — automate responses to scan events.",
};

export default function AutomationsPage() {
  return <AutomationsClient />;
}
