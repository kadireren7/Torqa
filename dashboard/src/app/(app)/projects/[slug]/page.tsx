import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban, Play, Radar } from "lucide-react";
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
import { getPolicies, getProjectBySlug, getValidationRuns } from "@/data/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "Project" };
  return { title: project.name, description: project.description ?? undefined };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [runsAll, policies] = await Promise.all([getValidationRuns(), getPolicies()]);
  const runs = runsAll.filter((r) => r.projectId === project.id);
  const defaultPolicy =
    project.defaultPolicyId != null ? policies.find((p) => p.id === project.defaultPolicyId) : null;

  const scanHref = `/scan?project=${encodeURIComponent(project.slug)}`;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-8">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              All projects
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
              <FolderKanban className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Project</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{project.slug}</p>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {project.description ?? "No description."} Mock scope today: link this to a repo path or bundle directory
            when the cloud project API lands.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button asChild className="gap-2">
            <Link href={scanHref}>
              <Play className="h-4 w-4" />
              Run project scan
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/workflow-library">
              <Radar className="h-4 w-4" />
              Workflow library
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Scope</CardTitle>
            <CardDescription>Planned linkage for CI and folders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Organization:</span>{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">{project.organizationId}</code>
            </p>
            <p>
              <span className="font-medium text-foreground">Default policy:</span>{" "}
              {defaultPolicy ? (
                <>
                  {defaultPolicy.name}{" "}
                  <Badge variant="outline" className="ml-1 align-middle text-[10px]">
                    {defaultPolicy.trustProfile}
                  </Badge>
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs">
              Configure workspace policies on{" "}
              <Link href="/policies" className="text-primary underline-offset-2 hover:underline">
                Policies
              </Link>
              .
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
            <CardDescription>Governance loop for this project.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/scan/history">Scan results</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/schedules">Schedules</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/integrations">Integrations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card id="recent-runs" className="border-border/80 shadow-sm scroll-mt-24">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-lg">Recent runs</CardTitle>
            <CardDescription>Validation history tied to this project (mock data).</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/validation">Open validation hub</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {runs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No runs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead className="pr-6 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/validation/${r.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {r.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "succeeded" ? "default" : "secondary"} className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.policyName ?? "—"}</TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
