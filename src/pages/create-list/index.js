import { initCreateListPage } from "./page-controller.js";
import { renderCreateListPageTemplate } from "./page-template.js";
import "./create-list.css";

export function renderCreateListPage() {
	queueMicrotask(() => {
		initCreateListPage();
	});

	return renderCreateListPageTemplate();
}
