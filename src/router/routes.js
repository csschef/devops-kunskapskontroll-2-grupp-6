import { renderHomePage } from "../pages/home/index.js";
import { renderCreateListPage } from "../pages/create-list/index.js";
import { renderLayoutEditorPage } from "../pages/layout-editor/index.js";
import { renderShoppingListPage } from "../pages/shopping-list/index.js";
import { renderProfilePage, setupProfilePage } from "../pages/profile/index.js";
import { renderLoginPage, setupLoginPage } from "../pages/login/index.js";
import { renderRegisterPage, setupRegisterPage } from "../pages/register/index.js";

export const routes = [
  {
    pattern: /^\/$/,
    render: (path) => renderHomePage(path),
    requiresAuth: true,
  },
  {
    pattern: /^\/create-list($|\/)/,
    render: (path) => renderCreateListPage(path),
    requiresAuth: true,
  },
  {
    pattern: /^\/layout-editor($|\/)/,
    render: (path) => renderLayoutEditorPage(path),
    requiresAuth: true,
  },
  {
    pattern: /^\/list($|\/)/,
    render: (path) => renderShoppingListPage(path),
    requiresAuth: true,
  },
  {
    pattern: /^\/profile($|\/)/,
    render: (path) => renderProfilePage(path),
    onMount: () => setupProfilePage(),
    requiresAuth: true,
  },
  {
    pattern: /^\/login($|\/)/,
    render: () => renderLoginPage(),
    onMount: () => setupLoginPage(),
    requiresAuth: false,
  },
  {
    pattern: /^\/register($|\/)/,
    render: () => renderRegisterPage(),
    onMount: () => setupRegisterPage(),
    requiresAuth: false,
  },
];

// Resolves the current pathname to a route definition.
export function resolveRoute(pathname) {
	for (const route of routes) {
		const match = route.pattern.exec(pathname);

		if (match) {
			return {
				render: route.render,
				onMount: route.onMount,
				requiresAuth: route.requiresAuth !== false,
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
		onMount: undefined,
		requiresAuth: false,
		path: pathname,
	};
}
