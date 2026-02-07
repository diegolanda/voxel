import { test, expect } from "@playwright/test";

test.describe("Static pages", () => {
  test("/terms renders Terms heading", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /Terms/i })).toBeVisible();
  });

  test("/privacy renders Privacy heading", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /Privacy/i })).toBeVisible();
  });
});
