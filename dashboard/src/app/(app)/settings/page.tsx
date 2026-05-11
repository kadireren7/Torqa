import Link from "next/link";
import { ArrowRight, Bell, Bot, ClipboardList, Code2, Cpu, Gauge, KeyRound, ScrollText, ShieldCheck, Store, Users, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Configure</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          API keys, workspace, team, and notification preferences.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-primary/40 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-primary" />
              Governance mode
            </CardTitle>
            <CardDescription>
              Pick how Torqa acts on findings: autonomous, supervised, or interactive. Drives Fix Engine + audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/settings/governance">
                Configure mode
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pending approvals
            </CardTitle>
            <CardDescription>
              Queued fix proposals waiting for human approval (supervised + interactive modes).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/approvals">
                Open queue
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              API Keys
            </CardTitle>
            <CardDescription>
              Create, revoke, and manage API keys. Use with cURL, GitHub Actions, n8n, or any CI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/settings/api">
                Manage API keys
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>
              Personal scan alert preferences — email, in-app thresholds, and mute rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/settings/notifications">
                Notification prefs
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Workspace &amp; Team
            </CardTitle>
            <CardDescription>
              Manage your workspace, team members, and organization settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/workspace">
                Workspace settings
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4 w-4 text-primary" />
              Enforcement Webhooks
            </CardTitle>
            <CardDescription>
              Outbound HTTP callbacks triggered on governance decisions — FAIL, NEEDS REVIEW, or custom triggers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/settings/webhooks">
                Manage webhooks
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Audit Log
            </CardTitle>
            <CardDescription>
              Full event trail — integrations, scans, policies, access changes, API key activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/settings/audit-log">
                View audit log
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              SSO / Identity
            </CardTitle>
            <CardDescription>
              Single sign-on via OIDC. Configure your IdP connection and domain restrictions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/settings/sso">
                SSO settings
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Advanced / integrations */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Advanced</p>
        <p className="mt-1 text-sm text-muted-foreground">API, integrations, and developer tools.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code2 className="h-4 w-4 text-primary" />
              Developer
            </CardTitle>
            <CardDescription>
              API reference, MCP server setup, CI gate examples, and webhook verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/developer">
                API reference
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4 text-primary" />
              Audit Log
            </CardTitle>
            <CardDescription>
              Full event trail — governance decisions, API key usage, source connections, policy changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/audit">
                View audit log
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-primary" />
              Policy Marketplace
            </CardTitle>
            <CardDescription>
              Browse, install, and publish governance policy packs shared by the community.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/marketplace">
                Browse marketplace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              Agent Runtime
            </CardTitle>
            <CardDescription>
              Real-time policy evaluation for AI agent events. Test the governance engine interactively.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/agent-runtime">
                Agent runtime
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4 text-primary" />
              MCP Server
            </CardTitle>
            <CardDescription>
              Connect Claude or any MCP-compatible AI assistant to Torqa&apos;s governance engine via JSON-RPC 2.0.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/mcp">
                MCP setup
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
