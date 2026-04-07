// Renders the home page content.
// Handles subroutes like /home/{subroute} (if needed)
export function renderHomePage() {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "home" (or empty on root)
	document.title = "AISLE - Hem";

	return `
		<section>
			<h1>Home</h1>
		</section>
	`;
}
