import { initCreateListPage } from "./page-controller.js";
import { renderCreateListPageTemplate } from "./page-template.js";
import "./create-list.css";

export function renderCreateListPage() {
	document.title = "AISLE - Skapa inköpslista";

	queueMicrotask(() => {
		initCreateListPage();
	});

	return renderCreateListPageTemplate();
}
