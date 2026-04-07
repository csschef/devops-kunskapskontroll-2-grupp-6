import { getMyProfile, signOut } from "../../auth-service.js";
import { navigateTo } from "../../router/router.js";

// Renders the profile page content.
// Handles subroutes like /profile/{subroute} (if needed)
export function renderProfilePage() {
	// const parts = path.split("/").filter(Boolean);
	// parts[0] = "profile"
	document.title = "AISLE - Profil";

	return `
		<section class="page-container">
			<h1>Profile</h1>
			<p>Profile settings and account details.</p>

			<div class="card" style="max-width: 640px;">
				<p><strong>Namn:</strong> <span id="profile-name">Laddar...</span></p>
				<p><strong>E-post:</strong> <span id="profile-email">Laddar...</span></p>
				<button class="btn btn-danger" id="profile-logout" type="button">Logga ut</button>
				<p id="profile-message" style="margin-top: 12px;"></p>
			</div>
		</section>
	`;
}

export function setupProfilePage() {
	const profileName = document.querySelector("#profile-name");
	const profileEmail = document.querySelector("#profile-email");
	const logoutButton = document.querySelector("#profile-logout");
	const profileMessage = document.querySelector("#profile-message");

	if (!profileName || !profileEmail || !logoutButton || !profileMessage) {
		return;
	}

	void (async () => {
		try {
			const profile = await getMyProfile();

			profileName.textContent = profile?.name || "Saknar namn";
			profileEmail.textContent = profile?.email || "Saknar e-post";
		} catch (error) {
			profileMessage.textContent = error?.message || "Kunde inte hämta profil.";
		}
	})();

	logoutButton.addEventListener("click", async () => {
		logoutButton.disabled = true;
		profileMessage.textContent = "Loggar ut...";

		try {
			await signOut();
			navigateTo("/login", { replace: true });
		} catch (error) {
			profileMessage.textContent = error?.message || "Kunde inte logga ut.";
			logoutButton.disabled = false;
		}
	});
}
