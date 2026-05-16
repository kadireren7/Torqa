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

  test("GET /openapi.yaml serves OpenAPI document", async ({ request }) => {
    const res = await request.get("/openapi.yaml");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain("openapi: 3.0.3");
    expect(text).toMatch(/version: "\d+\.\d+\.\d+"/);
    expect(text).toContain("/api/public/scan");
  });

  test("marketing home shows MCP workflow agent hero", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /build mcp workflows from claude/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /try web builder/i }).first()).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Torqa dashboard", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("dashboard surfaces", () => {
  test("console shows MCP Workflow Agent title", async ({ page }) => {
    await page.goto("/overview");
    await expect(
      page.getByRole("heading", { name: /torqa mcp workflow agent/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /open web builder/i }).first()).toBeVisible();
  });

  test("mcp-server page shows server command and tools", async ({ page }) => {
    await page.goto("/mcp-server");
    await expect(page.getByRole("heading", { name: /torqa mcp server/i })).toBeVisible();
    await expect(page.getByText(/npm run mcp:server/i).first()).toBeVisible();
    await expect(page.getByText("torqa.create_workflow_from_prompt")).toBeVisible();
  });

  test("web builder opens", async ({ page }) => {
    await page.goto("/demo/mcp-workflow-builder");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("pricing shows planned credits honestly", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /open-source local/i })).toBeVisible();
    await expect(page.getByText(/credit packs/i).first()).toBeVisible();
    await expect(page.getByText(/planned/i).first()).toBeVisible();
  });

  test("credits page is marked planned", async ({ page }) => {
    await page.goto("/credits");
    await expect(page.getByRole("heading", { name: /hosted credits/i })).toBeVisible();
    await expect(page.getByText(/planned/i).first()).toBeVisible();
  });
});
