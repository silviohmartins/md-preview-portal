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

    const colorTrigger = page.getByRole("button", { name: "Escolher cor" });
    const widthTrigger = page.getByRole("button", {
      name: "Escolher espessura",
    });
    const penButton = page.getByTestId("annotation-tool-pen");
    await expect(colorTrigger).toHaveCSS(
      "width",
      await penButton.evaluate((button) => getComputedStyle(button).width),
    );
    await expect(widthTrigger).toHaveCSS(
      "width",
      await penButton.evaluate((button) => getComputedStyle(button).width),
    );
    await colorTrigger.click();
    await expect(page.getByRole("group", { name: "Cores" })).toBeVisible();
    await expect(colorTrigger).toHaveAttribute("aria-expanded", "true");
    await widthTrigger.click();
    await expect(page.getByRole("group", { name: "Cores" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Espessuras" })).toBeVisible();
    await expect(colorTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(widthTrigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Espessuras" })).toHaveCount(0);
    await expect(overlay).toBeVisible();

    const layer = page.getByTestId("annotation-layer");
    const box = await layer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80);
    await page.mouse.up();

    await expect(layer.locator("path")).toHaveCount(1, { timeout: 5_000 });

    await page.getByTestId("annotation-clear").click();
    await expect(
      page.getByRole("dialog", { name: "Limpar todas as anotações?" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Limpar todas as anotações?" }),
    ).not.toBeVisible();
    await expect(overlay).toBeVisible();
    await expect(layer.locator("path")).toHaveCount(1);

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

  test("keeps annotations after editing the same document", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("preview-expand").click();
    await page.getByTestId("annotation-mode-draw").click();

    const layer = page.getByTestId("annotation-layer");
    const box = await layer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80, { steps: 20 });
    await page.mouse.up();
    await expect(layer.locator("path")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("preview-overlay")).not.toBeVisible();

    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText("\n\nEdição posterior ao desenho.");
    await expect(page.getByText("Edição posterior ao desenho.")).toBeVisible();

    await page.getByTestId("preview-expand").click();
    await expect(page.getByTestId("annotation-layer").locator("path")).toHaveCount(
      1,
    );
  });

  test("rescales and restores annotations after resize and reload", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("preview-expand").click();
    await page.getByTestId("annotation-mode-draw").click();

    const layer = page.getByTestId("annotation-layer");
    const box = await layer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 240, box.y + 160, { steps: 20 });
    await page.mouse.up();
    const path = layer.locator("path");
    await expect(path).toHaveCount(1);
    const originalPath = await path.getAttribute("d");

    await page.setViewportSize({ width: 820, height: 900 });
    await expect(path).not.toHaveAttribute("d", originalPath ?? "");

    await page.reload();
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByTestId("preview-expand").click();
    await expect(page.getByTestId("annotation-layer").locator("path")).toHaveCount(
      1,
    );
  });

  test("shows annotation quota failures in the overlay", async ({ page }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key.startsWith("md-annotations:")) {
          throw new DOMException("full", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
    });
    await page.goto("/");
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("preview-expand").click();
    await page.getByTestId("annotation-mode-draw").click();

    const layer = page.getByTestId("annotation-layer");
    const box = await layer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 60);
    await page.mouse.up();

    await expect(page.getByTestId("annotation-storage-error")).toContainText(
      "Armazenamento de anotações cheio",
    );
  });
});
