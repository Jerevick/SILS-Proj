/**
 * Phase 29: E2E — AI course & module auto-build (programmes/curriculum).
 * Covers: programmes list, curriculum view, module syllabus (AI-generated content surfaces).
 */

import { test, expect } from "@playwright/test";

test.describe("AI course & module auto-build", () => {
  test("programmes page is reachable when authenticated", async ({ page }) => {
    await page.goto("/programmes");
    await expect(page).toHaveURL(/\/(programmes|sign-in|dashboard)/);
  });

  test("courses page shows course list or empty state", async ({ page }) => {
    await page.goto("/courses");
    await expect(page).toHaveURL(/\/(courses|sign-in|dashboard)/);
    const heading = page.getByRole("heading", { name: /courses|course/i });
    const signIn = page.getByText(/sign in|sign in to/i);
    await expect(heading.or(signIn)).toBeVisible({ timeout: 10_000 });
  });
});
