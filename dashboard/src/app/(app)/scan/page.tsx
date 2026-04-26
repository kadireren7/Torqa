"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, FileJson2, Loader2, Play, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  runPreviewScan,
  type PreviewDecision,
  type PreviewFinding,
  type PreviewResult,
  type PreviewSource,
} from "@/lib/scan-preview";
import { cn } from "@/lib/utils";

function decisionBadgeClass(d: PreviewDecision): string {
  if (d === "PASS") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (d === "NEEDS REVIEW") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function severityBadgeClass(s: PreviewFinding["severity"]): string {
  if (s === "high") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (s === "review") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

export default function ScanPage() {
  const [jsonText, setJsonText] = useState("");
  const [source, setSource] = useState<PreviewSource>("n8n");
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const runScan = useCallback(() => {
    setError(null);
    setResult(null);
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setError("Paste JSON or upload a file first.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setError("Invalid JSON — fix syntax and try again.");
      return;
    }
    setResult(runPreviewScan(parsed, source));
  }, [jsonText, source]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setJsonText(text);
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const loadSample = async (name: "minimal_n8n" | "customer_support_n8n") => {
    setLoadingSample(name);
    setError(null);
    setResult(null);
    setSource("n8n");
    try {
      const res = await fetch(`/scan-samples/${name}.json`);
      if (!res.ok) throw new Error("fetch failed");
      const text = await res.text();
      setJsonText(text);
    } catch {
      setError("Could not load sample JSON.");
    } finally {
      setLoadingSample(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Workflow scan</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Upload or paste workflow JSON for a quick <strong className="font-medium">dashboard preview</strong> — rules run
          in your browser only. For production-grade validation, use the Torqa CLI or a future API.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Input</CardTitle>
          <CardDescription>JSON file, paste area, and source hint for heuristics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label htmlFor="scan-file">JSON file</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="scan-file"
                  type="file"
                  accept="application/json,.json"
                  onChange={onFile}
                  className="block w-full max-w-xs cursor-pointer text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/80"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingSample !== null}
                onClick={() => loadSample("minimal_n8n")}
              >
                {loadingSample === "minimal_n8n" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson2 className="mr-2 h-4 w-4" />
                )}
                Load minimal n8n example
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingSample !== null}
                onClick={() => loadSample("customer_support_n8n")}
              >
                {loadingSample === "customer_support_n8n" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="mr-2 h-4 w-4" />
                )}
                Load risky customer support example
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scan-source">Source</Label>
              <select
                id="scan-source"
                value={source}
                onChange={(e) => setSource(e.target.value as PreviewSource)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="n8n">n8n workflow export</option>
                <option value="generic">Generic JSON</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-json">Paste JSON</Label>
            <textarea
              id="scan-json"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{ "name": "…", "nodes": [ … ] }'
              spellCheck={false}
              rows={14}
              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs leading-relaxed text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="button" onClick={runScan} className="gap-2">
            <Play className="h-4 w-4" />
            Run scan
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">{result.label}</span>
            <span className="text-muted-foreground"> — mock rules in the browser; not the Torqa Python engine.</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Outcome</CardDescription>
                <CardTitle className="text-base font-medium">Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className={cn("font-semibold", decisionBadgeClass(result.decision))}>
                  {result.decision}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>0–100 (demo)</CardDescription>
                <CardTitle className="text-base font-medium">Risk score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{result.risk_score}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Rows</CardDescription>
                <CardTitle className="text-base font-medium">Findings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{result.findings.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Heuristic source</CardDescription>
                <CardTitle className="text-base font-medium">Source type</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="font-normal capitalize">
                  {result.source === "n8n" ? "n8n" : "generic JSON"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Findings</CardTitle>
              <CardDescription>Severity, rule id, target, explanation, and suggested fix.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Severity</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="min-w-[200px]">Explanation</TableHead>
                      <TableHead className="pr-6 min-w-[200px]">Suggested fix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.findings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                          No findings for this input under preview rules.
                        </TableCell>
                      </TableRow>
                    ) : (
                      result.findings.map((f, i) => (
                        <TableRow key={`${f.rule_id}-${f.target}-${i}`} className="border-border/60">
                          <TableCell className="pl-6 align-top">
                            <Badge variant="outline" className={cn("font-medium capitalize", severityBadgeClass(f.severity))}>
                              {f.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top font-mono text-xs text-muted-foreground">{f.rule_id}</TableCell>
                          <TableCell className="align-top text-sm">{f.target}</TableCell>
                          <TableCell className="align-top text-sm">{f.explanation}</TableCell>
                          <TableCell className="pr-6 align-top text-sm text-muted-foreground">{f.suggested_fix}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
