import { expect, test } from "@playwright/test";

test("app root loads", async ({ page }) => {
	await page.goto("/");
	// Check that the main app container exists
	const appElement = page.locator("#app");
	await expect(appElement).toBeAttached();
});
