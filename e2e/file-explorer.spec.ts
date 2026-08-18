import { test, expect } from "@playwright/test";

test.describe("file explorer smoke", () => {
  test("shows file tree and open-folder controls", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("mdstudio.io")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("file-tree-collapsed")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("open-folder")).toBeVisible();
    await expect(page.getByTestId("save-file")).toBeDisabled();
    await expect(page.getByTestId("status-footer")).toContainText(
      "Auto-save localStorage",
    );
  });

  test("collapses and expands the file tree panel", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("file-tree-collapsed")).toBeVisible();
    await page.getByTestId("expand-file-tree").click();
    await expect(page.getByTestId("file-tree")).toBeVisible();
    await expect(page.getByTestId("file-tree-collapsed")).not.toBeVisible();

    await page.getByTestId("collapse-file-tree").click();
    await expect(page.getByTestId("file-tree-collapsed")).toBeVisible();
    await expect(page.getByTestId("file-tree")).not.toBeVisible();
  });
});
