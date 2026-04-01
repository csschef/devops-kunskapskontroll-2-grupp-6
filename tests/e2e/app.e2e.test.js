import { expect, test } from "@playwright/test";

test("app root loads", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("body")).toBeVisible();
});
