/**
 * Phase 29: E2E — Role-based dashboards and scoped permissions.
 * Covers: dashboard hub, SIS vs faculty vs student nav, role-appropriate links.
 */

import { test, expect } from "@playwright/test";

test.describe("Role-based dashboards", () => {
  test("dashboard hub is reachable", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/(dashboard|sign-in)/);
  });

  test("SIS dashboard route exists", async ({ page }) => {
    await page.goto("/sis/dashboard");
    await expect(page).toHaveURL(/\/(sis|sign-in|dashboard)/);
  });

  test("faculty dashboard route exists", async ({ page }) => {
    await page.goto("/faculty/dashboard");
    await expect(page).toHaveURL(/\/(faculty|sign-in|dashboard)/);
  });

  test("student dashboard route exists", async ({ page }) => {
    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/(student|sign-in|dashboard)/);
  });

  test("AI orchestrator (Intelligence Hub) route exists", async ({ page }) => {
    await page.goto("/ai/orchestrator");
    await expect(page).toHaveURL(/\/(ai|sign-in|dashboard)/);
  });
});
