import PDFDocument from "pdfkit";
import type { ScanApiSuccess } from "@/lib/scan-engine";
import { buildScanRecommendations } from "@/lib/scan-report-recommendations";

export type ScanReportPdfModel = {
  /** Shown in header / metadata (scan UUID or share token id). */
  reportIdLabel: string;
  workflowName: string | null;
  source: string;
  createdAt: string;
  result: ScanApiSuccess;
};

const PAGE_MARGIN = 48;
const MAX_FINDINGS_IN_PDF = 60;

function contentWidth(doc: InstanceType<typeof PDFDocument>): number {
  return doc.page.width - PAGE_MARGIN * 2;
}

function heading(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.moveDown(0.8);
  doc.fontSize(11).fillColor("#0f766e").text(text.toUpperCase(), { width: contentWidth(doc) });
  doc.moveDown(0.35);
  doc.fillColor("#0f172a");
}

function body(doc: InstanceType<typeof PDFDocument>, text: string, size = 10) {
  doc.fontSize(size).fillColor("#334155").text(text, { width: contentWidth(doc), align: "left" });
}

function monoLine(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.fontSize(9).fillColor("#475569").font("Courier").text(text, { width: contentWidth(doc) });
  doc.font("Helvetica");
}

/**
 * Renders a Torqa scan report as a PDF buffer (pdfkit — no headless browser; Vercel-friendly).
 */
export function generateScanReportPdfBuffer(model: ScanReportPdfModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "LETTER",
      info: {
        Title: `Torqa scan — ${model.reportIdLabel}`,
        Author: "Torqa",
        Subject: "Workflow security scan report",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { result, workflowName, source, createdAt, reportIdLabel } = model;

    doc.fontSize(22).fillColor("#0d9488").text("Torqa", { width: contentWidth(doc) });
    doc.moveDown(0.15);
    doc.fontSize(16).fillColor("#0f172a").text("Scan report", { width: contentWidth(doc) });
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor("#64748b");
    doc.text(`Report ID: ${reportIdLabel}`, { width: contentWidth(doc) });
    if (workflowName) {
      doc.text(`Workflow: ${workflowName}`, { width: contentWidth(doc) });
    }
    doc.text(`Generated: ${new Date().toISOString()}`, { width: contentWidth(doc) });

    heading(doc, "Summary");
    doc.fontSize(11).fillColor("#0f172a");
    doc.text(`Status: ${result.status}`, { width: contentWidth(doc) });
    doc.text(`Risk score: ${result.riskScore} / 100`, { width: contentWidth(doc) });
    doc.text(`Source type: ${source}`, { width: contentWidth(doc) });
    doc.text(`Scan saved at: ${createdAt}`, { width: contentWidth(doc) });
    doc.text(
      `Findings — total: ${result.totals.all} | critical+high: ${result.totals.high} | review: ${result.totals.review} | info: ${result.totals.info}`,
      { width: contentWidth(doc) }
    );

    if (result.policyEvaluation) {
      heading(doc, "Policy evaluation");
      const pe = result.policyEvaluation;
      doc.fontSize(10).fillColor("#334155");
      doc.text(`Applied policy: ${pe.appliedPolicyName}`, { width: contentWidth(doc) });
      doc.text(`Policy gate: ${pe.policyStatus}`, { width: contentWidth(doc) });
      if (pe.violations.length > 0) {
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor("#b91c1c").text("Violations:", { width: contentWidth(doc) });
        for (const v of pe.violations.slice(0, 24)) {
          doc.fontSize(9).fillColor("#475569").text(`• [${v.severity}] ${v.code}: ${v.message}`, {
            width: contentWidth(doc),
          });
        }
      }
      if (pe.recommendations.length > 0) {
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor("#334155").text("Policy recommendations:", { width: contentWidth(doc) });
        for (const r of pe.recommendations.slice(0, 12)) {
          doc.fontSize(9).text(`• ${r}`, { width: contentWidth(doc) });
        }
      }
    }

    heading(doc, "Findings");
    const findings = result.findings.slice(0, MAX_FINDINGS_IN_PDF);
    if (findings.length === 0) {
      body(doc, "No findings in this snapshot.");
    } else {
      for (let i = 0; i < findings.length; i += 1) {
        const f = findings[i];
        doc.moveDown(0.35);
        doc.fontSize(10).fillColor("#0f172a").text(`${i + 1}. [${f.severity.toUpperCase()}] ${f.rule_id}`, {
          width: contentWidth(doc),
        });
        doc.fontSize(9).fillColor("#475569").text(`Target: ${f.target}`, { width: contentWidth(doc) });
        doc.fontSize(9).fillColor("#334155").text(f.explanation, { width: contentWidth(doc) });
        monoLine(doc, `Fix: ${f.suggested_fix}`);
        doc.font("Helvetica");
      }
      if (result.findings.length > MAX_FINDINGS_IN_PDF) {
        doc.moveDown(0.5);
        body(doc, `… ${result.findings.length - MAX_FINDINGS_IN_PDF} additional findings omitted from this PDF.`);
      }
    }

    heading(doc, "Recommendations");
    const recs = buildScanRecommendations(result);
    for (let i = 0; i < recs.length; i += 1) {
      doc.fontSize(10).fillColor("#334155").text(`${i + 1}. ${recs[i]}`, { width: contentWidth(doc) });
      doc.moveDown(0.25);
    }

    heading(doc, "Engine metadata");
    doc.fontSize(9).fillColor("#475569");
    doc.text(`engine: ${result.engine}`, { width: contentWidth(doc) });
    doc.text(`engine_mode: ${result.engine_mode}`, { width: contentWidth(doc) });
    doc.text(`analysis_kind: ${result.analysis_kind}`, { width: contentWidth(doc) });
    const fb = result.fallback;
    doc.text(
      `fallback_used: ${fb.fallback_used} | from: ${fb.fallback_from ?? "—"} | to: ${fb.fallback_to ?? "—"} | reason: ${fb.fallback_reason ?? "—"}`,
      { width: contentWidth(doc) }
    );

    doc.moveDown(1.2);
    doc.fontSize(8).fillColor("#94a3b8").text("Torqa — deterministic workflow posture scan. Not a substitute for full IR validation (torqa validate).", {
      width: contentWidth(doc),
    });

    doc.end();
  });
}
