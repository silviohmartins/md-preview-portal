import { test, expect } from "@playwright/test";

test.describe("preview annotations", () => {
  test("draw mode toggle and Escape exits draw before closing overlay", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("preview-expand").click();

    const overlay = page.getByTestId("preview-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("annotation-toolbar")).toBeVisible();
    await expect(page.getByTestId("annotation-layer")).toBeVisible();

    await page.getByTestId("annotation-mode-draw").click();
    await expect(page.getByTestId("annotation-drawing-badge")).toBeVisible();
    await expect(page.getByTestId("annotation-mode-draw")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const layer = page.getByTestId("annotation-layer");
    const box = await layer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80);
    await page.mouse.up();

    await expect(layer.locator("path")).toHaveCount(1, { timeout: 5_000 });

    // First Escape: leave draw mode, keep overlay open
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("annotation-drawing-badge")).toHaveCount(0);
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("annotation-mode-navigate")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Second Escape: close overlay
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });

  test("navigate mode keeps Escape closing overlay immediately", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("preview-expand").click();

    const overlay = page.getByTestId("preview-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("annotation-mode-navigate")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });
});
