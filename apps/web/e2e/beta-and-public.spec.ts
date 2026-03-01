/**
 * Phase 29: E2E — Beta signup and public pages.
 */

import { test, expect } from "@playwright/test";

test.describe("Beta page", () => {
  test("beta page shows waitlist form", async ({ page }) => {
    await page.goto("/beta");
    await expect(page.getByRole("heading", { name: /join the beta/i })).toBeVisible();
    await expect(page.getByLabel(/institution name/i)).toBeVisible();
    await expect(page.getByLabel(/contact email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /join waitlist/i })).toBeVisible();
  });

  test("beta form validation requires email and institution", async ({ page }) => {
    await page.goto("/beta");
    await page.getByRole("button", { name: /join waitlist/i }).click();
    await expect(page.getByLabel(/institution name/i)).toBeVisible();
  });
});

test.describe("Public home", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });
});
