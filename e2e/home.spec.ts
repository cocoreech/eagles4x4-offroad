import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and renders without errors", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();

    // The document should have a non-empty title.
    await expect(page).toHaveTitle(/.+/);

    // The page body should be visible.
    await expect(page.locator("body")).toBeVisible();
  });
});
