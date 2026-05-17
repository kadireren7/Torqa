import { expect, test } from "@playwright/test";

test.describe("public smoke", () => {
  test("GET /api/health returns JSON snapshot", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("checks");
  });

  test("landing shows local-first MCP workflow builder hero", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /local-first visual mcp workflow builder for claude/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /open web builder/i }).first(),
    ).toBeVisible();
  });

  test("builder page renders", async ({ page }) => {
    await page.goto("/builder");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /build mcp workflows/i }).first(),
    ).toBeVisible();
  });

  test("mcp-server setup page shows commands and tools", async ({ page }) => {
    await page.goto("/mcp-server");
    await expect(
      page.getByRole("heading", { name: /run torqa locally/i }),
    ).toBeVisible();
    await expect(page.getByText("npm run mcp:server").first()).toBeVisible();
    await expect(page.getByText("torqa.create_workflow_from_prompt")).toBeVisible();
  });

  test("/demo/mcp-workflow-builder redirects to /builder", async ({ page }) => {
    await page.goto("/demo/mcp-workflow-builder");
    await expect(page).toHaveURL(/\/builder$/);
  });
});
