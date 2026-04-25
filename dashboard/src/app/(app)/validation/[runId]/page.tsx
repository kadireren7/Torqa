import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getValidationRun } from "@/data/queries";
import { getMockResultJson } from "@/data/run-results";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type PageProps = { params: Promise<{ runId: string }> };

export default async function ValidationRunDetailPage({ params }: PageProps) {
  const { runId } = await params;
  const run = await getValidationRun(runId);
  if (!run) notFound();

  const json = getMockResultJson(runId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1 text-muted-foreground" asChild>
            <Link href="/validation">
              <ArrowLeft className="h-4 w-4" />
              Back to history
            </Link>
          </Button>
          <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">{run.id}</h1>
          <p className="text-sm text-muted-foreground">
            {run.projectName} · {run.trustProfile}
            {run.failOnWarning && " · fail-on-warning"}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>From stored run row</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Source</dt>
              <dd className="capitalize">{run.source.replace("_", " ")}</dd>
              <dt className="text-muted-foreground">Schema</dt>
              <dd className="font-mono text-xs">{run.resultSchema ?? "—"}</dd>
              <dt className="text-muted-foreground">Exit</dt>
              <dd>{run.exitCode ?? "—"}</dd>
            </dl>
            <Separator />
            {run.summary ? (
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd>{run.summary.total}</dd>
                <dt className="text-muted-foreground">Safe</dt>
                <dd className="text-emerald-500">{run.summary.safe}</dd>
                <dt className="text-muted-foreground">Review</dt>
                <dd className="text-amber-500">{run.summary.needsReview}</dd>
                <dt className="text-muted-foreground">Blocked</dt>
                <dd className="text-destructive">{run.summary.blocked}</dd>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">No summary yet (run in progress).</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Result JSON</CardTitle>
            <CardDescription>
              Mock payload matching Torqa CLI — fetch from{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">reports</code> or Storage in production.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {json ? (
              <ScrollArea className="h-[min(480px,55vh)] rounded-lg border border-border bg-muted/30">
                <pre className="p-4 font-mono text-xs leading-relaxed">
                  {JSON.stringify(json, null, 2)}
                </pre>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                No mock JSON for this run id — add one in{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">run-results.ts</code>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
