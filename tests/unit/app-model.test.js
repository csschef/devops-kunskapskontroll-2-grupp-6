import { describe, test, expect, beforeEach } from "vitest";
import { AppModel } from "../../src/app-model.js";
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
