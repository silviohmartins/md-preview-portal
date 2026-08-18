import { expect, test } from "@playwright/test";

test.describe("adaptive workbench", () => {
  test.use({ hasTouch: true });

  test("uses one pane and bottom actions at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("preview-scroll")).not.toBeVisible();
    await expect(page.getByRole("navigation", { name: "Ações do documento" })).toBeVisible();

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByTestId("preview-scroll")).toBeVisible();
    await expect(page.getByTestId("editor")).not.toBeVisible();

    await page.getByRole("button", { name: "Arquivos", exact: true }).click();
    const drawer = page.getByTestId("file-explorer-drawer");
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).toBeTruthy();
    expect(drawerBox!.width).toBeGreaterThanOrEqual(359);
    expect(drawerBox!.height).toBeLessThan(740);
    expect(drawerBox!.y).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("uses the full tablet width in single-pane mode", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("editor")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("preview-scroll")).not.toBeVisible();
    const editorBox = await page.getByTestId("editor").boundingBox();
    expect(editorBox).toBeTruthy();
    expect(editorBox!.width).toBeGreaterThan(850);

    await page.getByRole("button", { name: "Dividido", exact: true }).click();
    await expect(page.getByTestId("live-divider")).toBeVisible();
    await expect(page.getByTestId("preview-scroll")).toBeVisible();
  });

  test("persists the tablet view preference", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByTestId("preview-scroll")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("preview-scroll")).toBeVisible();
  });

  test("offers keyboard resizing and readable preview on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/");
    const divider = page.getByTestId("live-divider");
    await expect(divider).toBeVisible({ timeout: 20_000 });
    await divider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(divider).toHaveAttribute("aria-valuenow", "55");
    const dividerBox = await divider.boundingBox();
    expect(dividerBox).toBeTruthy();
    expect(dividerBox!.width).toBeGreaterThanOrEqual(40);

    await page.getByRole("button", { name: "Usar proporção 65/35" }).click();
    await expect(divider).toHaveAttribute("aria-valuenow", "65");
    await page.reload();
    await expect(page.getByTestId("live-divider")).toHaveAttribute("aria-valuenow", "65");

    await page.getByTestId("expand-file-tree").click();
    const explorerDivider = page.getByTestId("explorer-resizer");
    const explorerDividerBox = await explorerDivider.boundingBox();
    expect(explorerDividerBox).toBeTruthy();
    expect(explorerDividerBox!.width).toBeGreaterThanOrEqual(40);
    await explorerDivider.focus();
    await page.keyboard.press("End");
    await expect(explorerDivider).toHaveAttribute("aria-valuenow", "320");
    await page.reload();
    await page.getByTestId("expand-file-tree").click();
    await expect(page.getByTestId("explorer-resizer")).toHaveAttribute("aria-valuenow", "320");

    const article = page.locator(".preview-pane .preview-prose");
    const box = await article.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(900);
  });

  test("restores focus when closing the secondary menu with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const more = page.getByRole("button", { name: "Mais comandos" });
    await more.click();
    await page.getByRole("menuitem", { name: /Tema/ }).focus();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expect(page.getByRole("menu")).not.toBeVisible();
  });

  test("keeps semantic text tokens readable in both themes", async ({ page }) => {
    await page.goto("/");
    const ratios = await page.evaluate(() => {
      const luminance = (hex: string) => {
        const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => {
          const channel = Number.parseInt(value, 16) / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const ratio = (foreground: string, background: string) => {
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      const read = () => {
        const styles = getComputedStyle(document.documentElement);
        const surface = styles.getPropertyValue("--surface").trim();
        return [
          ratio(styles.getPropertyValue("--warning").trim(), surface),
          ratio(styles.getPropertyValue("--error").trim(), surface),
        ];
      };
      const light = read();
      document.documentElement.classList.add("dark");
      const dark = read();
      return [...light, ...dark];
    });
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("keeps expanded preview focus inside the dialog", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("preview-expand").click();
    const dialog = page.getByTestId("preview-overlay");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("preview-overlay-close")).toBeFocused();
    for (let index = 0; index < 20; index += 1) await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId("preview-expand")).toBeFocused();
  });
});
