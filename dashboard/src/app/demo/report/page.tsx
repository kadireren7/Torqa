import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { ScanReportView } from "@/components/scan-report-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoScanReport } from "@/lib/demo-report";

export const metadata = {
  title: "Torqa demo report",
  description: "Public demo scan report for first-time Torqa users.",
};

export default function DemoReportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-border/70 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-xl">Demo scan report</CardTitle>
          <CardDescription>
            Preview risk score, policy status, findings, recommendations, and PDF export before uploading your own file.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/scan">
              <Upload className="mr-2 h-4 w-4" />
              Try your own workflow
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to landing</Link>
          </Button>
        </CardContent>
      </Card>

      <ScanReportView
        result={demoScanReport}
        showPoweredBanner
        notice="Demo snapshot — use this structure as the baseline for your first production scan."
        pdfExportUrl="/api/demo/report/pdf"
        pdfFilename="torqa-demo-report.pdf"
      />

      <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
        Ready to test with a real export?{" "}
        <Link href="/scan" className="font-medium text-primary hover:underline">
          Run a scan
        </Link>{" "}
        and save or share the generated report.
        <ArrowRight className="ml-1 inline h-4 w-4" />
      </div>
    </div>
  );
}
