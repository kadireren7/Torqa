import { parseExpression } from "cron-parser";

/** Next fire time strictly after `from`, or null if expression is invalid. */
export function parseCronNextUtc(from: Date, expression: string, tz: string): Date | null {
  const expr = expression.trim();
  if (!expr) return null;
  const zone = (tz?.trim() || "UTC") || "UTC";
  try {
    const interval = parseExpression(expr, { currentDate: from, tz: zone });
    const next = interval.next();
    return next.toDate();
  } catch {
    return null;
  }
}

export function validateCronExpression(expression: string, tz: string): { ok: true } | { ok: false; error: string } {
  const next = parseCronNextUtc(new Date(), expression, tz);
  if (!next) return { ok: false, error: "Invalid cron expression or timezone." };
  return { ok: true };
}
