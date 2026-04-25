import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProjects } from "@/data/queries";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Each project maps to a Torqa scope (directory, repo path, or bundle set). Wire{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">GET /projects</code>{" "}
          later.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Card
            key={p.id}
            className="group border-border/80 bg-card/40 shadow-sm transition-colors hover:border-primary/25 hover:bg-card/80"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FolderKanban className="h-5 w-5" aria-hidden />
                </div>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" asChild>
                  <Link href="/validation">Runs</Link>
                </Button>
              </div>
              <CardTitle className="text-lg">{p.name}</CardTitle>
              <CardDescription className="font-mono text-xs">{p.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="line-clamp-2 min-h-[2.5rem]">{p.description ?? "—"}</p>
              <p className="text-xs">
                Updated{" "}
                <time dateTime={p.updatedAt}>{new Date(p.updatedAt).toLocaleDateString()}</time>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
