import { test, expect } from "@playwright/test";

test.describe("Signup page", () => {
  test("renders heading and email input", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    const emailInput = page.locator("#signup-email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(emailInput).toHaveAttribute("type", "email");
  });

  test("has OTP verification form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("#signup-token")).toBeVisible();
  });

  test("has cross-link to login", async ({ page }) => {
    await page.goto("/signup");
    const link = page.getByRole("link", { name: "Sign in" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/login");
  });
});

test.describe("Login page", () => {
  test("renders heading and email input", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const emailInput = page.locator("#login-email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(emailInput).toHaveAttribute("type", "email");
  });

  test("has OTP verification form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#login-token")).toBeVisible();
  });

  test("has cross-link to signup", async ({ page }) => {
    await page.goto("/login");
    const link = page.getByRole("link", { name: "Create account" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/signup");
  });
});
