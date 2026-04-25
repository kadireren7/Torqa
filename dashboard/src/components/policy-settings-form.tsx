"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Policy, Project } from "@/data/types";

type Props = {
  policies: Policy[];
  projects: Project[];
};

export function PolicySettingsForm({ policies, projects }: Props) {
  const [warnById, setWarnById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(policies.map((p) => [p.id, p.failOnWarning]))
  );

  return (
    <div className="space-y-6">
      {policies.map((p) => {
        const project = p.projectId ? projects.find((x) => x.id === p.projectId) : null;
        return (
          <div key={p.id} className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.slug}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {p.trustProfile}
                  </Badge>
                  {project ? (
                    <Badge variant="secondary">Project: {project.name}</Badge>
                  ) : (
                    <Badge variant="secondary">Org template</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                <Switch
                  id={`warn-${p.id}`}
                  checked={warnById[p.id] ?? false}
                  onCheckedChange={(c) => setWarnById((s) => ({ ...s, [p.id]: c }))}
                />
                <Label htmlFor={`warn-${p.id}`} className="cursor-pointer text-xs">
                  Fail on warning
                </Label>
              </div>
            </div>
            <Separator className="my-3" />
            <p className="text-[11px] text-muted-foreground">
              Local state — wire <code className="rounded bg-muted px-0.5">onCheckedChange</code> to your mutation.
            </p>
          </div>
        );
      })}
    </div>
  );
}
