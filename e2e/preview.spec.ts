import { test, expect } from "@playwright/test";

test.describe("live markdown preview", () => {
  test("renders heading when typing in editor", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("mdstudio.io")).toBeVisible({ timeout: 10_000 });
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

  test("expands preview overlay and closes with Escape", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("preview-expand").click();

    const overlay = page.getByTestId("preview-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay.locator(".preview-prose h1").first()).toBeVisible();
    await expect(page.getByTestId("annotation-toolbar")).toBeVisible();

    // Default mode is navigate — Escape closes immediately
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    await expect(res.json()).resolves.toEqual({ status: "ok" });
    expect(res.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("blocks remote Markdown images without a browser request", async ({
    page,
  }) => {
    const remoteUrl = "https://images.example.invalid/private.png";
    const remoteRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url() === remoteUrl) remoteRequests.push(request.url());
    });

    await page.goto("/");
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(`![Privada](${remoteUrl})`);

    await expect(page.getByText("[Imagem remota bloqueada: Privada]")).toBeVisible();
    expect(remoteRequests).toEqual([]);
  });

  test("exports a Mermaid preview to PDF with visible progress", async ({
    page,
  }) => {
    await page.goto("/");
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(
      "# Fluxo atual\n\n```mermaid\ngraph TD\n  A[Editar] --> B[Exportar]\n```",
    );

    await expect(page.locator(".preview-prose .mermaid-diagram svg")).toBeVisible({
      timeout: 20_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("preview-export-pdf").click();
    await expect(page.getByTestId("pdf-progress")).toBeVisible();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("mdstudio-io.pdf");
    await expect(page.getByTestId("pdf-progress")).not.toBeVisible();
  });
});
