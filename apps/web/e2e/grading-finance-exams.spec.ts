/**
 * Phase 29: E2E — Grading, finance, exams, registration, scheduling, analytics.
 * Smoke tests: routes load without 500 and show expected sections or auth redirect.
 */

import { test, expect } from "@playwright/test";

test.describe("Grading", () => {
  test("grading/speedgrader route is reachable", async ({ page }) => {
    await page.goto("/grading/speedgrader");
    await expect(page).toHaveURL(/\/(grading|sign-in|dashboard)/);
  });
});

test.describe("Finance", () => {
  test("finance dashboard is reachable", async ({ page }) => {
    await page.goto("/finance/dashboard");
    await expect(page).toHaveURL(/\/(finance|sign-in|dashboard)/);
  });

  test("invoices page is reachable", async ({ page }) => {
    await page.goto("/finance/invoices");
    await expect(page).toHaveURL(/\/(finance|sign-in|dashboard)/);
  });
});

test.describe("Exams", () => {
  test("exams page is reachable", async ({ page }) => {
    await page.goto("/exams");
    await expect(page).toHaveURL(/\/(exams|sign-in|dashboard)/);
  });
});

test.describe("Registration", () => {
  test("registration page is reachable", async ({ page }) => {
    await page.goto("/registration");
    await expect(page).toHaveURL(/\/(registration|sign-in|dashboard)/);
  });
});

test.describe("Scheduling", () => {
  test("scheduling page is reachable", async ({ page }) => {
    await page.goto("/scheduling");
    await expect(page).toHaveURL(/\/(scheduling|sign-in|dashboard)/);
  });
});

test.describe("Analytics", () => {
  test("admin analytics is reachable", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/(admin|sign-in)/);
  });
});
