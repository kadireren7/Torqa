import { getPolicies, getProjects } from "@/data/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PolicySettingsForm } from "@/components/policy-settings-form";

export default async function PolicySettingsPage() {
  const [policies, projects] = await Promise.all([getPolicies(), getProjects()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Policy settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Maps to <code className="rounded bg-muted px-1 font-mono text-xs">policies</code> — trust profile,
          fail-on-warning, and future <code className="rounded bg-muted px-1 font-mono text-xs">rules_overrides</code>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Bindings</CardTitle>
            <CardDescription>
              Org-wide templates vs project-scoped policies (mock UI state only).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicySettingsForm policies={policies} projects={projects} />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Built-in profiles</CardTitle>
            <CardDescription>Same set as the Torqa CLI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-2">
              <li>
                <span className="text-foreground">default</span> — balanced gate for handoff.
              </li>
              <li>
                <span className="text-foreground">strict</span> — tighter metadata and limits.
              </li>
              <li>
                <span className="text-foreground">review-heavy</span> — more review signals.
              </li>
              <li>
                <span className="text-foreground">enterprise</span> — stricter trust floor.
              </li>
            </ul>
            <p className="text-xs">
              Persist edits via PATCH to your API; keep optimistic UI in the form component.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
