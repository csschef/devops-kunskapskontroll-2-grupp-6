// Renders the layout editor page content.
// Handles subroutes like /layout-editor/{subroute} (if needed)
export function renderLayoutEditorPage() {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "layout-editor"

	return `
		<section>
			<h1>Layout Editor</h1>
			<p>Configure aisle and shelf layout.</p>
		</section>
	`;
}
