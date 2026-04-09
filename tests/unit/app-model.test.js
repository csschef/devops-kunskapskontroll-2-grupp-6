import { describe, test, expect, beforeEach } from "vitest";
import { renderLayoutEditorPage } from "../../src/pages/layout-editor/index.js";
import { createLatestListsMarkup, createTopLayoutsMarkup, createTopProductsMarkup, createStatsMarkup, createEmptyStateMarkup } from "../../src/pages/home/functions.js";

beforeEach(() => {
	// Clear the document body before each test to ensure a clean slate
	document.body.innerHTML = "";
});

describe("app-model", () => {
	// Viktor: Unit test for home page functions.
	describe("home page markup helpers", () => {
		test("produce expected markup", () => {
			const sampleLists = [{ id: 1, name: "Veckohandling", storeName: "ICA Maxi", storeCity: "Stockholm", updatedAt: new Date().toISOString() }, { id: 2, name: "Fika", storeName: "Coop", storeCity: "Göteborg", updatedAt: new Date().toISOString() }];
			const sampleLayouts = [{ storeName: "ICA Maxi", city: "Stockholm", likes: 5 }, { storeName: "Coop", city: "Göteborg", likes: 3 }];
			const sampleProducts = [{ name: "Mjölk", totalQuantity: 10 }, { name: "Bröd", totalQuantity: 7 }];
			const sampleStats = { totalLists: 5, activeLists: 3, completedLists: 2, mostCommonStore: "ICA Maxi" };
			const statsMarkup = createStatsMarkup(sampleStats);

			expect(createLatestListsMarkup(sampleLists)).toContain("Veckohandling");
			expect(createTopLayoutsMarkup(sampleLayouts)).toContain("ICA Maxi");
			expect(createTopProductsMarkup(sampleProducts)).toContain("Mjölk");
			expect(statsMarkup).toContain("Antal listor");
			expect(statsMarkup).toContain("Aktiva listor");
			expect(statsMarkup).toContain("Avklarade listor");
			expect(statsMarkup).toContain(">5<");
			expect(statsMarkup).toContain(">3<");
			expect(statsMarkup).toContain(">2<");
			expect(createEmptyStateMarkup("Test")).toContain("Test");
		});
	});

	// Sebbe: Unit test for layout editor render template.
	describe("layout editor template", () => {
		test("includes required fields and actions", () => {
			const html = renderLayoutEditorPage();

			expect(document.title).toBe("AISLE - Skapa butikslayout");
			expect(html).toContain('id="layout-editor-store-name"');
			expect(html).toContain('id="layout-editor-city-name"');
			expect(html).toContain('id="layout-editor-save-button"');
			expect(html).toContain('id="layout-editor-cancel-button"');
		});
	});
});
