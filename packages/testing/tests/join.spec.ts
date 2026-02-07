import { test, expect } from "@playwright/test";

test.describe("Join page", () => {
  test("shows missing invite token when no token provided", async ({ page }) => {
    await page.goto("/join/some-room-id");
    await expect(page.getByText("Missing invite token")).toBeVisible();
  });

  test("shows sign in required when unauthenticated with token", async ({ page }) => {
    await page.goto("/join/some-room-id?token=test-token");
    await expect(page.getByText("Sign in required")).toBeVisible();
  });
});
