import { expect, test } from "@playwright/test";

test.describe("alert flow", () => {
  test("alerts page loads", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("alerts page shows alert destinations section", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: /alert/i }).first()).toBeVisible();
  });

  test("alerts page has cloud-gate or list when no Supabase configured", async ({ page }) => {
    await page.goto("/alerts");
    // Either shows Connect Supabase message or the full alert rules UI
    const hasCloudGate = await page.getByText(/connect supabase/i).count() > 0;
    const hasAlertsUi = await page.getByText(/destination/i).count() > 0;
    expect(hasCloudGate || hasAlertsUi).toBeTruthy();
  });
});
