// Renders the create list page content.
// Handles subroutes like /create-list/{subroute} (if needed)
export function renderCreateListPage() {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "create-list"

	return `
		<section>
			<h1>Create List</h1>
			<p>Create a new shopping list.</p>
		</section>
	`;
}
