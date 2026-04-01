// Renders the profile page content.
// Handles subroutes like /profile/{subroute} (if needed)
export function renderProfilePage(path) {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "profile"

	return `
		<section>
			<h1>Profile</h1>
			<p>Profile settings and account details.</p>
		</section>
	`;
}
