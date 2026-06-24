import { test, expect } from "@playwright/test";

test.describe("live markdown preview", () => {
  test("renders heading when typing in editor", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("mdPreviewPortal")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });

    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible({ timeout: 20_000 });

    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("# Titulo E2E");

    await expect(page.locator(".preview-prose h1")).toHaveText("Titulo E2E", {
      timeout: 15_000,
    });
  });

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});
