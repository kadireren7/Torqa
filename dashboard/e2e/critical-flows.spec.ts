import { expect, test } from "@playwright/test";

test.describe("builder navigation", () => {
  test("landing → builder", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /open web builder/i }).first().click();
    await expect(page).toHaveURL(/\/builder$/);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("builder has GitHub link in header", async ({ page }) => {
    await page.goto("/builder");
    await expect(
      page.getByRole("link", { name: /github/i }).first(),
    ).toBeVisible();
  });
});
