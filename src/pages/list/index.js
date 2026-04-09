import { initShoppingListPage } from "./page-controller.js";
import { renderShoppingListPageTemplate } from "./page-template.js";
import "./list.css";

export function renderShoppingListPage(path) {
	queueMicrotask(() => {
		initShoppingListPage(path);
	});

	return renderShoppingListPageTemplate();
}
