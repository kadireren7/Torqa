import Link from "next/link";
import { getValidationRuns } from "@/data/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

export default async function ValidationHistoryPage() {
  const runs = await getValidationRuns();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Validation history</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Immutable runs — aligns with <code className="rounded bg-muted px-1 font-mono text-xs">validation_runs</code> in
          the cloud schema.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">All runs</CardTitle>
          <CardDescription>Select a row for JSON detail and lineage.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Run ID</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outcome</TableHead>
                  <TableHead className="pr-6 text-right">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} className="border-border/60">
                    <TableCell className="pl-6">
                      <Link
                        href={`/validation/${r.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.projectName}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                      {r.policyName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal capitalize">
                        {r.source.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.trustProfile}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.resultOk === true && (
                        <span className="text-emerald-500">Pass</span>
                      )}
                      {r.resultOk === false && (
                        <span className="text-destructive">Fail</span>
                      )}
                      {r.resultOk == null && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
