import { describe, test, expect, it } from "vitest";
import { renderLayoutEditorPage } from "../../src/pages/layout-editor/index.js";
import { setupLayoutEditorPage } from "../../src/pages/layout-editor/layout-editor-controller.js";
import { renderHomePage } from "../../src/pages/home/index.js";

const hasSupabaseEnv = Boolean(
	import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

async function getSupabaseClient() {
	const { supabase } = await import('../../src/api-service.js')
	return supabase
}

describe("app integration", () => {
	// Viktor: Integration test for home page render output.
	test("home page render includes key sections", () => {
		document.body.innerHTML = renderHomePage();

		expect(document.querySelector(".home-frontpage")).toBeTruthy();
		expect(document.querySelector("#home-welcome")?.textContent || "").toContain("Välkommen till AISLE");
		expect(document.querySelector("#home-active-content")).toBeTruthy();
		expect(document.querySelector("#home-layout-content")).toBeTruthy();
		expect(document.querySelector("#home-product-content")).toBeTruthy();
		expect(document.querySelector("#home-stats-content")).toBeTruthy();
	});

	// Sebbe: Integration test for layout editor init state.
	test("layout editor renders required lists and setup runs without crashing", async () => {
		document.body.innerHTML = renderLayoutEditorPage();
		expect(() => setupLayoutEditorPage()).not.toThrow();

		await new Promise((resolve) => setTimeout(resolve, 0));

		const activeList = document.querySelector("#layout-editor-active-list");
		const inactiveList = document.querySelector("#layout-editor-inactive-list");
		const loadingRow = inactiveList?.querySelector("li");

		expect(activeList).toBeTruthy();
		expect(inactiveList).toBeTruthy();
		expect(loadingRow?.textContent || "").toMatch(/Hämtar kategorier|Kunde inte hämta sektioner|Inga sektioner hittades/);
	});
});

// Database connection test
describe('Supabase connection', () => {
	const databaseTest = hasSupabaseEnv ? it : it.skip

	databaseTest('should connect to the database', async () => {
	const supabase = await getSupabaseClient()

	const { data, error } = await supabase
	  .from('products')
	  .select('*')
	  .limit(1)

	expect(error).toBeNull()
	expect(data).toBeDefined()
	})
})