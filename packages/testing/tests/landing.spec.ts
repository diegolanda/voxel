import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders the hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Voxel Worlds" })).toBeVisible();
  });

  test("has Create account and Sign in links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("navigates to /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL("/signup");
  });

  test("navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });
});
