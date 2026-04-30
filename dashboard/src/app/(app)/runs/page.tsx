import Link from "next/link";
import { Play } from "lucide-react";
import { EmptyStateCta } from "@/components/onboarding/empty-state-cta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/workspace-scope";
import { ScanOutcomeBadge } from "@/components/scan-outcome-badge";

export const dynamic = "force-dynamic";

type ScanRow = {
  id: string;
  user_id: string;
  source: string;
  workflow_name: string | null;
  organization_id: string | null;
  created_at: string;
  result: unknown;
};

function triggerType(source: string): string {
  if (source === "schedule") return "Schedule";
  if (source === "webhook" || source === "github") return "Webhook";
  if (source === "api") return "API";
  if (source === "pr") return "PR";
  return "Manual";
}

export default async function RunsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-8 pb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Monitor</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Every scan run — manual, scheduled, webhook, PR, or API triggered.
          </p>
        </div>
        <EmptyStateCta
          icon={Play}
          title="Cloud storage not configured"
          description="Set Supabase env vars to persist run history per user."
          primary={{ href: "/overview", label: "Overview" }}
          secondary={{ href: "/advanced/manual-scan", label: "Manual scan" }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const activeOrg = await getActiveOrganizationId();
  let query = supabase
    .from("scan_history")
    .select("id, user_id, source, workflow_name, organization_id, created_at, result");

  if (activeOrg) {
    query = query.eq("organization_id", activeOrg);
  } else {
    query = query.is("organization_id", null).eq("user_id", user.id);
  }

  const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-destructive">Could not load runs: {error.message}</p>
      </div>
    );
  }

  const list = (rows ?? []) as ScanRow[];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Monitor</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Every scan run — manual, scheduled, webhook, PR, or API triggered.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/advanced/manual-scan">Manual scan</Link>
        </Button>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">All runs</CardTitle>
          <CardDescription>Newest first. Click a run to open the full report.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {list.length === 0 ? (
            <div className="px-4 pb-6 pt-2 sm:px-6">
              <EmptyStateCta
                icon={Play}
                title="No runs yet"
                description="Connect a source or run a manual scan to start."
                primary={{ href: "/sources", label: "Connect a source" }}
                secondary={{ href: "/advanced/manual-scan", label: "Manual scan" }}
                className="border-border/60 bg-muted/20"
              />
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="flex flex-col divide-y divide-border/60 sm:hidden">
                {list.map((row) => {
                  const r = row.result as { status?: string; riskScore?: number } | null;
                  return (
                    <div key={row.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="secondary" className="font-normal capitalize shrink-0">{row.source}</Badge>
                          <span className="truncate text-sm font-medium">{row.workflow_name ?? "—"}</span>
                        </div>
                        <ScanOutcomeBadge status={r?.status ?? "unknown"} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{triggerType(row.source)} · Risk {r?.riskScore ?? "—"}</span>
                        <span>{new Date(row.created_at).toLocaleString()}</span>
                      </div>
                      <Link href={`/scan/${row.id}`} className="text-xs font-medium text-primary hover:underline self-start">
                        View report →
                      </Link>
                    </div>
                  );
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">When</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="pr-6 text-right">Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((row) => {
                      const r = row.result as { status?: string; riskScore?: number } | null;
                      return (
                        <TableRow key={row.id} className="border-border/60">
                          <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(row.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal capitalize">
                              {row.source}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {triggerType(row.source)}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm">
                            {row.workflow_name ?? "—"}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm text-muted-foreground">
                            {r?.riskScore ?? "—"}
                          </TableCell>
                          <TableCell>
                            <ScanOutcomeBadge status={r?.status ?? "unknown"} />
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Link href={`/scan/${row.id}`} className="font-mono text-xs text-primary hover:underline">
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
