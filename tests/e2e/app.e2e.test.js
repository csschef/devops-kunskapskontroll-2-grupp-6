import { expect, test } from "@playwright/test";

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;

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

// Sebbe: E2E test for layout-editor edit mode behavior.
test("layout editor shows update mode from query params when authenticated", async ({ page }) => {
	if (!e2eEmail || !e2ePassword) {
		throw new Error("E2E_EMAIL and E2E_PASSWORD must be set to run authenticated layout-editor e2e test.");
	}

	await page.goto("/login");
	await page.fill("#login-email", e2eEmail);
	await page.fill("#login-password", e2ePassword);
	await page.click("#login-submit");

	await expect(page).toHaveURL(/\/$/);

	await page.goto("/layout-editor?mode=edit&storeName=Willys&cityName=Kalmar&sections=frukt-gront,brod-bakverk");

	await expect(page.getByRole("heading", { name: "Uppdatera butikslayout" })).toBeVisible();
	await expect(page.locator("#layout-editor-save-button")).toHaveText("Uppdatera");
	await expect(page.locator("#layout-editor-save-button")).toBeDisabled();
});

// Hampus: create-list route protection + missing list id should redirect home
test("redirects to login when visiting create-list unauthenticated", async ({ page }) => {
	await page.goto("/create-list");
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});

test("non-existing list id should redirect to home", async ({ page }) => {
	if (!e2eEmail || !e2ePassword) {
		throw new Error("E2E_EMAIL and E2E_PASSWORD must be set to run list invalid-id e2e test.");
	}

	await page.goto("/login");
	await page.fill("#login-email", e2eEmail);
	await page.fill("#login-password", e2ePassword);
	await page.click("#login-submit");

	await expect(page).toHaveURL(/\/$/);

	await page.goto("/list/00000000-0000-4000-8000-000000000000");
	await expect(page).toHaveURL(/\/$/);
});

// Elsa: profile page shows shopping list names
test("profile page displays shopping list names", async ({ page }) => {
	if (!e2eEmail || !e2ePassword) {
		throw new Error("E2E_EMAIL and E2E_PASSWORD must be set to run profile shopping list display e2e test.");
	}

	await page.goto("/login");
	await page.fill("#login-email", e2eEmail);
	await page.fill("#login-password", e2ePassword);
	await page.click("#login-submit");

	await expect(page).toHaveURL(/\/$/);

	await page.goto("/profile");
	await expect(page.getByRole("heading", { name: "Mina inköpslistor" })).toBeVisible();
	await expect(page.locator(".shopping-list-card").first()).toBeVisible();
	await expect(page.locator(".shopping-list-card__title").first()).toHaveText(/.+/);
});
