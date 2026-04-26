/**
 * Browser-only workflow library when Supabase is not configured.
 * Stored in localStorage (same logical model as `workflow_templates` table).
 */

import type { ScanSource } from "@/lib/scan-engine";
import type { WorkflowTemplateDetail, WorkflowTemplateListItem } from "@/lib/workflow-template-types";

const STORAGE_KEY = "torqa_workflow_library_v1";

type StoredRow = {
  id: string;
  name: string;
  source: ScanSource;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function readRaw(): StoredRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: StoredRow[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = o.id;
      const name = o.name;
      const source = o.source;
      const content = o.content;
      const createdAt = o.createdAt;
      const updatedAt = o.updatedAt;
      if (
        typeof id !== "string" ||
        typeof name !== "string" ||
        (source !== "n8n" && source !== "generic") ||
        !content ||
        typeof content !== "object" ||
        Array.isArray(content) ||
        typeof createdAt !== "string" ||
        typeof updatedAt !== "string"
      ) {
        continue;
      }
      out.push({
        id,
        name,
        source,
        content: content as Record<string, unknown>,
        createdAt,
        updatedAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeRaw(rows: StoredRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function localWorkflowListItems(): WorkflowTemplateListItem[] {
  return readRaw()
    .map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function localWorkflowGet(id: string): WorkflowTemplateDetail | null {
  const row = readRaw().find((r) => r.id === id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function localWorkflowCreate(input: {
  name: string;
  source: ScanSource;
  content: Record<string, unknown>;
}): WorkflowTemplateDetail {
  const now = new Date().toISOString();
  const row: StoredRow = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 512) || "Untitled workflow",
    source: input.source,
    content: input.content,
    createdAt: now,
    updatedAt: now,
  };
  const rows = readRaw();
  rows.unshift(row);
  writeRaw(rows);
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function localWorkflowRename(id: string, name: string): boolean {
  const rows = readRaw();
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return false;
  rows[i] = {
    ...rows[i],
    name: name.trim().slice(0, 512) || rows[i].name,
    updatedAt: new Date().toISOString(),
  };
  writeRaw(rows);
  return true;
}

export function localWorkflowDelete(id: string): boolean {
  const rows = readRaw();
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  writeRaw(next);
  return true;
}
