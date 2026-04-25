import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import {
  getDashboardStats,
  getRiskTrend,
  getValidationRuns,
} from "@/data/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";

export default async function DashboardPage() {
  const [stats, trend, runs] = await Promise.all([
    getDashboardStats(),
    getRiskTrend(),
    getValidationRuns(),
  ]);
  const recent = runs.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Trust outcomes across projects — production-ready layout with mock data until
            Supabase is wired.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-1.5 self-start sm:self-auto">
          <Link href="/validation">
            View validation
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/80 bg-card/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Runs (7d)</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {stats.runCount7d}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Completed validation jobs
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Pass rate</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-emerald-500">
              {stats.passRate7d}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Runs with <span className="text-foreground">result_ok</span>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Blocked files (7d)</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-amber-500">
              {stats.blockedSpecs7d}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sum of blocked rows in scan summaries
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Active projects</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {stats.activeProjects}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Link href="/projects" className="text-primary hover:underline">
              Manage projects
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              Risk trend
            </CardTitle>
            <CardDescription>
              Stacked file outcomes (mock aggregate) — swap data source for live telemetry.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <RiskTrendChart data={trend} />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Recent validation</CardTitle>
            <CardDescription>Latest runs across all projects</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/validation">Open history</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-2 pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Run</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((r) => (
                <TableRow key={r.id} className="border-border/60">
                  <TableCell className="pl-6 font-mono text-xs">
                    <Link href={`/validation/${r.id}`} className="text-primary hover:underline">
                      {r.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{r.projectName}</TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">
                    {r.trustProfile}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
