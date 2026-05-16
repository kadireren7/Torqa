import { expect, test } from "@playwright/test";

test.describe("web workflow builder", () => {
  test("builder page renders", async ({ page }) => {
    await page.goto("/demo/mcp-workflow-builder");
    await expect(page.getByRole("main")).toBeVisible();
  });
});

test.describe("workflows redirect", () => {
  test("/workflows redirects to web builder", async ({ page }) => {
    await page.goto("/workflows");
    await expect(page).toHaveURL(/\/demo\/mcp-workflow-builder/);
  });
});

test.describe("settings", () => {
  test("settings page shows local mode", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText(/local/i).first()).toBeVisible();
  });
});
