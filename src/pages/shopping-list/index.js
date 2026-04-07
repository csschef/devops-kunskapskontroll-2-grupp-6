// Renders the shopping list page content.
// Handles subroutes like /list/{subroute} (if needed)
export function renderShoppingListPage() {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "list"
	document.title = "AISLE - Inköpslista";

	return `
		<section>
			<h1>Shopping List</h1>
			<p>Shopping list and product management.</p>
		</section>
	`;
}
