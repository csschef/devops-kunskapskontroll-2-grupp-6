import { getMyProfile, signOut } from "../../auth-service.js";
import { navigateTo } from "../../router/router.js";
import { setupProfileLayouts } from "./profile-layouts.js";
import { setupProfileShoppingLists } from "./profile-shopping-lists.js";
import "../profile/profile.css";
import aisleLogo from "../../assets/aisle-logo.svg";

export function renderProfilePage() {
	return `
		<div class="profile-page-wrapper">
			
			<div class="profile-top-bar">
				<a href="/" class="home-logo-link">
					<span class="home-logo" style="--home-logo-src: url('${aisleLogo}')" aria-hidden="true"></span>
				</a>
			</div>

			<div id="profile-page-container">
				
				<section class="profile-section-card profile-hero">
					<h1>Min profil</h1>
					<p>Profilinställningar och kontodetaljer.</p>

					<div class="profile-info-row-hero">
						<span class="profile-info-label">Namn</span>
						<span class="profile-info-value" id="profile-name">Laddar...</span>
					</div>
					<div class="profile-info-row-hero">
						<span class="profile-info-label">E-post</span>
						<span class="profile-info-value" id="profile-email">Laddar...</span>
					</div>
					
					<div class="profile-logout-group">
						<button class="btn btn-danger" id="profile-logout" type="button">Logga ut</button>
						<p class="profile-message" id="profile-message"></p>
					</div>
				</section>

				<section class="profile-section-card">
					<h2>Mina butikslayouter</h2>
					<div class="profile-cards-list" id="profile-layouts-container">
						<p class="profile-loading">Laddar layouter...</p>
					</div>
				</section>

				<section class="profile-section-card">
					<h2>Mina inköpslistor</h2>
					<div class="profile-cards-list" id="profile-shopping-lists-container">
						<p class="profile-loading">Laddar inköpslistor...</p>
					</div>
				</section>

			</div>
		</div>
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

	// Hämta personuppgifter
	void (async () => {
		try {
			const profile = await getMyProfile();
			profileName.textContent = profile?.name || "Saknar namn";
			profileEmail.textContent = profile?.email || "Saknar e-post";
		} catch (error) {
			profileMessage.textContent = error?.message || "Kunde inte hämta profil.";
			profileMessage.dataset.state = "error";
		}
	})();

	// Ladda layouter och inköpslistor
	setupProfileLayouts();
	setupProfileShoppingLists();

	// Logga ut
	logoutButton.addEventListener("click", async () => {
		logoutButton.disabled = true;
		profileMessage.textContent = "Loggar ut...";
		profileMessage.dataset.state = "";

		try {
			await signOut();
			navigateTo("/login", { replace: true });
		} catch (error) {
			profileMessage.textContent = error?.message || "Kunde inte logga ut.";
			profileMessage.dataset.state = "error";
			logoutButton.disabled = false;
		}
	});
}