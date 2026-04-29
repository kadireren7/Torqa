import { describe, expect, it } from "vitest";
import { parseCronNextUtc, validateCronExpression } from "./cron-schedule";

describe("cron-schedule", () => {
  it("parses next run for daily 9am UTC", () => {
    const from = new Date("2026-01-01T10:00:00.000Z");
    const next = parseCronNextUtc(from, "0 9 * * *", "UTC");
    expect(next).not.toBeNull();
    expect(next!.getUTCHours()).toBe(9);
    expect(next!.getTime()).toBeGreaterThan(from.getTime());
  });

  it("validates Monday 09:00 expression", () => {
    const v = validateCronExpression("0 9 * * 1", "UTC");
    expect(v.ok).toBe(true);
  });

  it("rejects invalid cron", () => {
    const v = validateCronExpression("not-a-cron", "UTC");
    expect(v.ok).toBe(false);
  });
});
