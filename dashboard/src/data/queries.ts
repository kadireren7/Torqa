/**
 * Data access layer — swap implementations for Supabase / REST without changing UI.
 */

import {
  MOCK_ORG,
  MOCK_POLICIES,
  MOCK_PROJECTS,
  MOCK_RISK_TREND,
  MOCK_RUNS,
  MOCK_TEAM,
} from "./mock";
import type {
  Organization,
  Policy,
  Project,
  RiskTrendPoint,
  TeamMember,
  ValidationRun,
} from "./types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getOrganization(): Promise<Organization> {
  await delay(40);
  return MOCK_ORG;
}

export async function getProjects(): Promise<Project[]> {
  await delay(50);
  return [...MOCK_PROJECTS];
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  await delay(40);
  return MOCK_PROJECTS.find((p) => p.slug === slug) ?? null;
}

export async function getPolicies(): Promise<Policy[]> {
  await delay(45);
  return [...MOCK_POLICIES];
}

export async function getValidationRuns(): Promise<ValidationRun[]> {
  await delay(60);
  return [...MOCK_RUNS].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getValidationRun(id: string): Promise<ValidationRun | null> {
  await delay(40);
  return MOCK_RUNS.find((r) => r.id === id) ?? null;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  await delay(35);
  return [...MOCK_TEAM];
}

export async function getRiskTrend(): Promise<RiskTrendPoint[]> {
  await delay(55);
  return [...MOCK_RISK_TREND];
}

export async function getDashboardStats(): Promise<{
  runCount7d: number;
  passRate7d: number;
  blockedSpecs7d: number;
  activeProjects: number;
}> {
  await delay(70);
  const runs = MOCK_RUNS.filter(
    (r) => r.completedAt && new Date(r.completedAt) > new Date(Date.now() - 7 * 86_400_000)
  );
  const finished = runs.filter((r) => r.status === "succeeded" || r.status === "failed");
  const passed = finished.filter((r) => r.resultOk === true).length;
  const blockedSpecs = finished.reduce(
    (acc, r) => acc + (r.summary?.blocked ?? 0),
    0
  );
  return {
    runCount7d: finished.length || 12,
    passRate7d: finished.length ? Math.round((passed / finished.length) * 100) : 88,
    blockedSpecs7d: blockedSpecs || 14,
    activeProjects: MOCK_PROJECTS.length,
  };
}
