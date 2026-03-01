/**
 * Phase 29: E2E — Onboarding flow.
 * Covers: deployment mode selection, institution details form, submit request.
 */

import { test, expect } from "@playwright/test";

test.describe("Onboarding flow", () => {
  test("home has link to onboarding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /sign in|onboarding|get started/i })).toBeVisible();
  });

  test("onboarding page shows deployment mode step", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /institution onboarding/i })).toBeVisible();
    await expect(page.getByText(/deployment mode/i)).toBeVisible();
  });

  test("can select mode and see details form", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: /LMS only/i }).first().click();
    await expect(page.getByLabel(/institution name/i)).toBeVisible();
    await expect(page.getByLabel(/contact email/i)).toBeVisible();
  });

  test("validation requires required fields", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: /LMS only/i }).first().click();
    await page.getByRole("button", { name: /submit request/i }).click();
    await expect(page.getByLabel(/institution name/i)).toBeVisible();
    // Form should still be there (validation prevents submit)
    await expect(page.getByRole("button", { name: /submit request|back/i })).toBeVisible();
  });
});
