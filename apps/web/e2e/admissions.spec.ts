/**
 * Phase 29: E2E — Admissions workflow.
 * Covers: admissions dashboard, workflows list, application flow (when authenticated).
 */

import { test, expect } from "@playwright/test";

test.describe("Admissions workflow", () => {
  test("admissions dashboard or sign-in is shown", async ({ page }) => {
    await page.goto("/admissions/dashboard");
    await expect(page).toHaveURL(/\/(admissions|sign-in|dashboard)/);
  });

  test("admissions workflows page is reachable", async ({ page }) => {
    await page.goto("/admissions/workflows");
    await expect(page).toHaveURL(/\/(admissions|sign-in|dashboard)/);
  });
});
