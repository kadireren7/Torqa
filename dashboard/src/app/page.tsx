import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  GitBranch,
  LayoutDashboard,
  MessageSquareShare,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const githubUrl = "https://github.com/kadireren7/ai-ir-programming-system";

const featureItems = [
  "Risk-aware scan outcomes and policy gates",
  "In-app notifications for FAIL and high-risk scans",
  "Email and Slack alert channel placeholders",
  "Workspace-level collaboration and invite flows",
];

const useCases = [
  "Engineering managers tracking risky workflow changes before rollout",
  "Security teams adding lightweight guardrails to AI-assisted delivery",
  "Founders needing clear trust metrics without enterprise overhead",
];

export default function MarketingLandingPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_38%),radial-gradient(circle_at_80%_0%,hsl(var(--chart-3)/0.16),transparent_36%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 sm:px-8 lg:py-24">
          <Badge className="w-fit border-primary/30 bg-primary/10 text-primary">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Modern trust layer for AI workflows
          </Badge>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Torqa helps teams ship AI workflows with confidence.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                Detect failure signals fast, flag high-risk scans automatically, and keep everyone aligned
                with one premium command center.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/overview">
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={githubUrl} target="_blank" rel="noreferrer">
                    <GitBranch className="mr-2 h-4 w-4" />
                    View on GitHub
                  </Link>
                </Button>
              </div>
            </div>
            <Card className="border-border/70 bg-card/70 shadow-xl backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg">Why teams choose Torqa</CardTitle>
                <CardDescription>From scan to alert in seconds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Built for fast-moving product and platform teams
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Notification rules tied to FAIL and high-risk outcomes
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Ready to plug into email and Slack channels
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:px-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Problem</CardTitle>
            <CardDescription>AI workflow risk is easy to miss until incidents happen.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Teams juggle fragmented tools, ad-hoc checks, and delayed incident visibility. Without clear
            scan intelligence, risky changes move to production unnoticed.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Scan, classify risk, notify the right people.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Run a scan on workflow specs.</p>
            <p>2. Torqa evaluates outcomes and risk markers.</p>
            <p>3. In-app alerts trigger on FAIL or high-risk thresholds.</p>
            <p>4. Email and Slack channels are ready for integration.</p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Features</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {featureItems.map((feature) => (
            <Card key={feature} className="border-border/70 bg-card/60">
              <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {feature}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard screenshots</h2>
          <Link href="/overview" className="text-sm text-primary hover:underline">
            Open live dashboard
          </Link>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <ScreenshotCard title="Overview analytics" icon={LayoutDashboard} />
          <ScreenshotCard title="Alert settings" icon={BellRing} />
          <ScreenshotCard title="Slack + email channels" icon={MessageSquareShare} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Use cases</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {useCases.map((item) => (
            <Card key={item}>
              <CardContent className="p-5 text-sm text-muted-foreground">{item}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
        <Card className="border-primary/20 bg-primary/[0.07]">
          <CardHeader>
            <CardTitle className="text-2xl">Pricing</CardTitle>
            <CardDescription>Placeholder pricing until plan tiers are finalized.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">Starter — TBD</Badge>
            <Badge variant="secondary">Growth — TBD</Badge>
            <Badge variant="secondary">Enterprise — TBD</Badge>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 sm:px-8">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Ready to operationalize trust?</CardTitle>
            <CardDescription>Start with the dashboard and expand to your channels.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/overview">
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={githubUrl} target="_blank" rel="noreferrer">
                <GitBranch className="mr-2 h-4 w-4" />
                GitHub link
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row sm:px-8">
          <p>Torqa — Trust gates for AI workflow operations.</p>
          <p>
            <Link href={githubUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}

function ScreenshotCard({
  title,
  icon: Icon,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/40">
      <div className="h-44 border-b border-border/60 bg-gradient-to-br from-muted/70 via-muted/40 to-primary/[0.10] p-4">
        <div className="flex h-full items-end justify-between rounded-lg border border-border/60 bg-background/80 p-3">
          <div className="space-y-2">
            <div className="h-2 w-24 rounded bg-muted-foreground/30" />
            <div className="h-2 w-16 rounded bg-muted-foreground/20" />
            <div className="h-10 w-32 rounded-md bg-primary/15" />
          </div>
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <CardContent className="p-4 text-sm text-muted-foreground">{title}</CardContent>
    </Card>
  );
}
