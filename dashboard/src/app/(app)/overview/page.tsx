import type { Metadata } from "next";
import { getHomeDashboardData } from "@/data/home-metrics";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description: "Connect sources, monitor workflows, enforce policies continuously.",
};

type DecisionRow = {
  id: string;
  decision_type: string;
  finding_signature: string | null;
  rationale: string | null;
  mode: string | null;
  created_at: string;
};

async function getRecentDecisions(): Promise<DecisionRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("governance_decisions")
    .select("id, decision_type, finding_signature, rationale, mode, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []) as DecisionRow[];
}

export default async function DashboardOverviewPage() {
  const [home, decisions] = await Promise.all([
    getHomeDashboardData(),
    getRecentDecisions(),
  ]);

  return <OverviewClient home={home} decisions={decisions} />;
}
