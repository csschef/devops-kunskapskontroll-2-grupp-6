import { renderHomePage } from "../pages/home/index.js";
import { renderCreateListPage } from "../pages/create-list/index.js";
import { renderLayoutEditorPage } from "../pages/layout-editor/index.js";
import { renderShoppingListPage } from "../pages/shopping-list/index.js";
import { renderProfilePage } from "../pages/profile/index.js";

export const routes = [
  {
    pattern: /^\/$/,
    render: (path) => renderHomePage(path),
  },
  {
    pattern: /^\/create-list($|\/)/,
    render: (path) => renderCreateListPage(path),
  },
  {
    pattern: /^\/layout-editor($|\/)/,
    render: (path) => renderLayoutEditorPage(path),
  },
  {
    pattern: /^\/list($|\/)/,
    render: (path) => renderShoppingListPage(path),
  },
  {
    pattern: /^\/profile($|\/)/,
    render: (path) => renderProfilePage(path),
  },
];

// Resolves the current pathname to a route definition.
export function resolveRoute(pathname) {
	for (const route of routes) {
		const match = route.pattern.exec(pathname);

		if (match) {
			return {
				render: route.render,
				path: pathname,
			};
		}
	}

	return {
		render: () => `
			<section>
				<h1>404</h1>
				<p>Page not found.</p>
			</section>
		`,
		path: pathname,
	};
}
