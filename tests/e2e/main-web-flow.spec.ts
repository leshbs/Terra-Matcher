import { expect, test } from "@playwright/test";

test("main navigation reaches Explorer and Ranking from the canonical landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /gale crater/i })).toBeVisible();
  await expect(page.getByText(/not mission-site approval/i)).toBeVisible();

  await page.getByRole("link", { name: /explore terrain/i }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole("heading", { name: /terra analog explorer/i })).toBeVisible();

  await page.getByRole("link", { name: /open ranking/i }).click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.getByRole("heading", { name: /earth candidate ranking/i })).toBeVisible();
  await expect(page.getByText(/data-derived similarity, not mission-site approval/i).first()).toBeVisible();
});
