// Renders the shopping list page content.
// Handles subroutes like /list/{subroute} (if needed)
export function renderShoppingListPage(path) {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "list"

	return `
		<section>
			<h1>Shopping List</h1>
			<p>Shopping list and product management.</p>
		</section>
	`;
}
