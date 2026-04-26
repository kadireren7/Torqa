/** Best-effort title from pasted / uploaded workflow JSON. */
export function extractWorkflowName(content: unknown): string | undefined {
  if (!content || typeof content !== "object" || Array.isArray(content)) return undefined;
  const n = (content as Record<string, unknown>).name;
  if (typeof n === "string" && n.trim()) return n.trim().slice(0, 512);
  return undefined;
}
