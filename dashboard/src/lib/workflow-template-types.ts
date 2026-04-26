import type { ScanSource } from "@/lib/scan-engine";

export type WorkflowTemplateListItem = {
  id: string;
  name: string;
  source: ScanSource;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowTemplateDetail = WorkflowTemplateListItem & {
  content: Record<string, unknown>;
};
