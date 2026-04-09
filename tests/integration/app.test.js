import { describe, test, expect, it, beforeEach, vi } from "vitest";
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
	beforeEach(() => {
		document.body.innerHTML = "";
	});

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

// Hampus: create-list works + unauthorized user cannot access other list
describe("create-list and list integration", () => {
	test("creating a list via API works", async () => {
		vi.resetModules();

		const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

		vi.doMock("../../src/api-service.js", () => ({
			supabase: {
				from: (table) => {
					if (table !== "shopping_lists") {
						throw new Error("Unexpected table");
					}

					return {
						insert: () => ({
							select: () => ({
								single: async () => ({ data: { id: "created-list-id" }, error: null }),
							}),
						}),
						select: () => ({
							eq: () => ({
								maybeSingle: async () => ({ data: { id: "created-list-id", user_id: ownerId }, error: null }),
							}),
						}),
					};
				},
				auth: {
					getUser: async () => ({ data: { user: null }, error: null }),
				},
			},
		}));

		const { createShoppingList } = await import("../../src/pages/create-list/api.js");
		const { userHasAccessToList } = await import("../../src/pages/list/api.js");

		const createdListId = await createShoppingList({
			storeId: "44444444-4444-4444-8444-444444444444",
			layoutId: null,
			userId: ownerId,
			title: "Veckohandling",
		});

		const hasAccess = await userHasAccessToList(createdListId, ownerId);

		expect(createdListId).toBe("created-list-id");
		expect(hasAccess).toBe(true);
	});

	test("unauthorized user cannot access someone else's list", async () => {
		vi.resetModules();

		vi.doMock("../../src/api-service.js", () => ({
			supabase: {
				from: (table) => {
					if (table === "shopping_lists") {
						return {
							select: () => ({
								eq: () => ({
									maybeSingle: async () => ({ data: { id: "list-1", user_id: "owner-1" }, error: null }),
								}),
							}),
						};
					}

					if (table === "shopping_list_members") {
						return {
							select: () => ({
								eq: () => ({
									eq: () => ({
										maybeSingle: async () => ({ data: null, error: null }),
									}),
								}),
							}),
						};
					}

					throw new Error("Unexpected table");
				},
				auth: {
					getUser: async () => ({ data: { user: null }, error: null }),
				},
			},
		}));

		const { userHasAccessToList } = await import("../../src/pages/list/api.js");
		const hasAccess = await userHasAccessToList("list-1", "stranger-1");

		expect(hasAccess).toBe(false);
	});
});