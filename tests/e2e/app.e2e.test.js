import { expect, test } from "@playwright/test";

test("app root loads", async ({ page }) => {
	await page.goto("/");
	// Check that the main app container exists
	const appElement = page.locator("#app");
	await expect(appElement).toBeAttached();
});

// Viktor: Tests if you get redirected to login page instead of profile page when not authenticated.
test("redirects to login when visiting protected page unauthenticated", async ({ page }) => {
	await page.goto("/profile");
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});
