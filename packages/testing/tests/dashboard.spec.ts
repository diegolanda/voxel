import { test, expect } from "@playwright/test";

test.describe("Protected routes (unauthenticated)", () => {
  test("/app redirects to /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/play/fake-room-id redirects to /login", async ({ page }) => {
    await page.goto("/play/fake-room-id");
    await expect(page).toHaveURL(/\/login/);
  });
});
