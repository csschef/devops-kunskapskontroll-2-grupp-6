import { describe, test, expect, vi } from "vitest";
import { renderLayoutEditorPage } from "../../src/pages/layout-editor/index.js";

describe("app-model", () => {
	// Sebbe: Unit test for layout editor render template.
	test("layout editor template includes required fields and actions", () => {
		const html = renderLayoutEditorPage();

		expect(document.title).toBe("AISLE - Skapa butikslayout");
		expect(html).toContain('id="layout-editor-store-name"');
		expect(html).toContain('id="layout-editor-city-name"');
		expect(html).toContain('id="layout-editor-save-button"');
		expect(html).toContain('id="layout-editor-cancel-button"');
	});
});

// Hampus: creating a list assigns owner + items belong to correct list
describe("create-list and list unit tests", () => {
	test("creating a list assigns an owner", async () => {
		vi.resetModules();

		const ownerId = "11111111-1111-4111-8111-111111111111";
		const storeId = "22222222-2222-4222-8222-222222222222";
		const captured = { payload: null };

		vi.doMock("../../src/api-service.js", () => ({
			supabase: {
				from: (table) => {
					if (table !== "shopping_lists") {
						throw new Error("Unexpected table");
					}

					return {
						insert: (payload) => {
							captured.payload = payload;
							return {
								select: () => ({
									single: async () => ({ data: { id: "new-list-id" }, error: null }),
								}),
							};
						},
					};
				},
			},
		}));

		const { createShoppingList } = await import("../../src/pages/create-list/api.js");
		await createShoppingList({ storeId, layoutId: null, userId: ownerId, title: "Test" });

		expect(captured.payload.user_id).toBe(ownerId);
	});

	test("a list contains items belonging to that list", async () => {
		vi.resetModules();

		const listId = "33333333-3333-4333-8333-333333333333";

		vi.doMock("../../src/api-service.js", () => ({
			supabase: {
				from: (table) => {
					if (table === "shopping_list_items") {
						return {
							select: () => ({
								eq: async () => ({
									data: [{ id: "item-1", shopping_list_id: listId, product_id: null }],
									error: null,
								}),
							}),
						};
					}

					if (table === "products" || table === "categories") {
						return {
							select: () => ({
								in: async () => ({ data: [], error: null }),
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

		const { getShoppingListItems } = await import("../../src/pages/list/api.js");
		const items = await getShoppingListItems(listId, { skipAccessCheck: true });

		expect(items).toHaveLength(1);
		expect(items[0].shopping_list_id).toBe(listId);
	});
});
