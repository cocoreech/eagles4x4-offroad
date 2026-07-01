import { test, expect } from "@playwright/test";

/**
 * Smoke coverage for the public, server-rendered pages. Each of these renders
 * a Server Component that calls the async `createClient()` (Supabase), so a
 * clean load here confirms the Next 16 async-request-API migration works at
 * runtime, not just at type-check time.
 */
// `/bookings/new` is public on purpose: guest checkout means a visitor can
// reach the booking form without an account (see createBooking's guest path).
const publicPages = ["/", "/services", "/builds", "/events", "/login", "/bookings/new"];

for (const path of publicPages) {
  test(`public page ${path} renders without a server error`, async ({ page }) => {
    const response = await page.goto(path);
    // No 4xx/5xx — server components and their Supabase calls resolved.
    expect(response?.status(), `status for ${path}`).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
}

/**
 * Protected routes must bounce an unauthenticated visitor to /login — this
 * exercises the middleware route-protection path (which itself refreshes the
 * Supabase session via the async server client).
 */
const protectedPages = ["/bookings"];

for (const path of protectedPages) {
  test(`protected page ${path} redirects unauthenticated user to /login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}
