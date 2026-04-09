import { getMyProfile } from "../../auth-service.js";
import { getHomeDashboardData } from "./api.js";
import { resolveDisplayName, createLatestListsMarkup, createTopLayoutsMarkup, createTopProductsMarkup, createStatsMarkup, createEmptyStateMarkup } from "./functions.js";
import "./style.css";
import aisleLogo from "../../assets/aisle-logo.svg";

// I'm not super happy with how this page turned out. It was supposed to be a quick and easy page, but it grew a bit too much maybe and I've now created a bit of a mess. Oh well, it works but it's not the quality I want.

function selectHomeElements() {
	const welcomeElement = document.querySelector("#home-welcome");
	const sublineElement = document.querySelector("#home-hero-subline");
	const profileLink = document.querySelector("#home-profile-link");
	const profileLinkLabel = document.querySelector("#home-auth-link-label");
	const activeContent = document.querySelector("#home-active-content");
	const activeCounter = document.querySelector("#home-active-counter");
	const layoutCounter = document.querySelector("#home-layout-counter");
	const layoutContent = document.querySelector("#home-layout-content");
	const productContent = document.querySelector("#home-product-content");
	const statsContent = document.querySelector("#home-stats-content");
	if (!welcomeElement || !sublineElement || !profileLink || !profileLinkLabel || !activeContent || !activeCounter || !layoutCounter || !layoutContent || !productContent || !statsContent) { return null; }
	return { welcomeElement, sublineElement, profileLink, profileLinkLabel, activeContent, activeCounter, layoutCounter, layoutContent, productContent, statsContent };
}

function applyTopbarAuthState(elements, isAuthenticated) {
	elements.profileLink.hidden = false;
	elements.profileLink.href = isAuthenticated ? "/profile" : "/login";
	elements.profileLinkLabel.textContent = isAuthenticated ? "Mina sidor" : "Logga in";
}

function renderGuestState(elements) {
	elements.welcomeElement.textContent = "Välkommen till AISLE";
	elements.sublineElement.textContent = "Skapa smarta inköpslistor, personifiera din dagliga handel och spara tid i vardagen.";
	applyTopbarAuthState(elements, false);
	elements.activeCounter.textContent = "Inloggning krävs";
	elements.layoutCounter.textContent = "Inloggning krävs";
	elements.activeContent.innerHTML = createEmptyStateMarkup("Du måste logga in för att se dina senaste inköpslistor.");
	elements.layoutContent.innerHTML = createEmptyStateMarkup("Logga in för att se topplistan över butikslayouter.");
	elements.productContent.innerHTML = createEmptyStateMarkup("Logga in för att se produktstatistik.");
	elements.statsContent.innerHTML = createEmptyStateMarkup("Logga in för att se din personliga statistik.");
}

function renderAuthenticatedState(elements, { displayName, dashboard }) {
	elements.welcomeElement.textContent = `Välkommen, ${displayName}`;
	elements.sublineElement.textContent = "Här är en snabb översikt över ditt konto och dina inköpslistor.";
	applyTopbarAuthState(elements, true);

	const latestLists = dashboard.latestLists || [];
	const topLayouts = dashboard.topLayouts || [];
	const topProducts = dashboard.topProducts || [];
	const userStats = dashboard.userStats || null;

	elements.activeCounter.textContent = `${latestLists.length} senaste`;
	elements.layoutCounter.textContent = topLayouts.length ? "Topp 3" : "Ingen data";
	elements.activeContent.innerHTML = latestLists.length ? createLatestListsMarkup(latestLists) : createEmptyStateMarkup("Du har inga inköpslistor än.");
	elements.layoutContent.innerHTML = topLayouts.length ? createTopLayoutsMarkup(topLayouts) : createEmptyStateMarkup("Ingen layoutdata tillgänglig just nu.");
	elements.productContent.innerHTML = topProducts.length ? createTopProductsMarkup(topProducts) : createEmptyStateMarkup("Ingen produktstatistik tillgänglig just nu.");
	elements.statsContent.innerHTML = createStatsMarkup(userStats);
}

function renderErrorState(elements) {
	elements.welcomeElement.textContent = "Välkommen till AISLE";
	applyTopbarAuthState(elements, false);
	elements.activeCounter.textContent = "Inloggning krävs";
	elements.layoutCounter.textContent = "Ingen data";
	elements.activeContent.innerHTML = createEmptyStateMarkup("Kunde inte ladda listor just nu.");
	elements.layoutContent.innerHTML = createEmptyStateMarkup("Kunde inte ladda layouter just nu.");
	elements.productContent.innerHTML = createEmptyStateMarkup("Kunde inte ladda produktstatistik just nu.");
	elements.statsContent.innerHTML = createEmptyStateMarkup("Kunde inte ladda statistik just nu.");
}

export function renderHomePage() {
	document.title = "AISLE - Framsida";

	return `
		<section class="home-frontpage">
			<header class="home-topbar">
				<a href="/" class="home-logo-link" aria-label="Till startsidan">
					<span class="home-logo" style="--home-logo-src: url('${aisleLogo}')" aria-hidden="true"></span>
				</a>
				<div class="home-topbar-actions">
					<a class="btn btn-secondary" id="home-profile-link" href="/login" hidden>
						<i class="ti ti-user-circle" aria-hidden="true"></i>
						<span id="home-auth-link-label">Logga in</span>
					</a>
				</div>
			</header>

			<section class="home-hero" aria-labelledby="home-welcome">
				<p class="home-kicker">Smartare handling varje vecka</p>
				<h1 id="home-welcome">Välkommen till AISLE</h1>
				<p id="home-hero-subline" class="home-hero-subline">
					Planera din inköpsrunda med listor som följer butikens gångordning, så att du handlar snabbare och missar mindre.
				</p>
				<div class="home-hero-actions">
					<a class="btn btn-primary" href="/create-list">
						<i class="ti ti-plus" aria-hidden="true"></i>
						Skapa ny inköpslista
					</a>
				</div>
			</section>

			<section class="home-about" aria-label="Om AISLE">
				<article>
					<h2>Vad är AISLE?</h2>
					<p>AISLE är ett verktyg för inköpslistor som hjälper dig sortera varor efter butikslayout och hållbar vardagsplanering.</p>
				</article>
				<article>
					<h2>För vem?</h2>
					<p>För dig som vill handla snabbare, samarbeta i hushållet och alltid ha listorna tillgängliga i mobilen.</p>
				</article>
				<article>
					<h2>Hur funkar det?</h2>
					<p>Skapa en lista, välj butik och få en tydlig ordning på dina varor. Du kan spara favoriter och återanvända tidigare listor.</p>
				</article>
			</section>

			<section class="home-data-grid" aria-label="Dina listor">
				<section class="home-data-panel" aria-labelledby="home-active-heading">
					<div class="home-data-panel-head">
						<h2 id="home-active-heading">Senaste inköpslistor</h2>
						<span class="home-counter" id="home-active-counter">Senaste</span>
					</div>
					<div id="home-active-content" class="home-list-stack">
						<p class="home-locked-message">Du måste logga in för att se dina senaste inköpslistor.</p>
					</div>
				</section>

				<section class="home-data-panel" aria-labelledby="home-layout-heading">
					<div class="home-data-panel-head">
						<h2 id="home-layout-heading">Mest använda butikslayouter</h2>
						<span class="home-counter" id="home-layout-counter">Topp 3</span>
					</div>
					<div id="home-layout-content" class="home-list-stack">
						<p class="home-locked-message">Logga in för att se topplistan.</p>
					</div>
				</section>

				<section class="home-data-panel" aria-labelledby="home-product-heading">
					<div class="home-data-panel-head">
						<h2 id="home-product-heading">Mest inhandlade produkter</h2>
						<span class="home-counter">Topp 3</span>
					</div>
					<div id="home-product-content" class="home-list-stack">
						<p class="home-locked-message">Logga in för att se produktstatistik.</p>
					</div>
				</section>

				<section class="home-data-panel home-data-panel-stats" aria-labelledby="home-stats-heading">
					<div class="home-data-panel-head">
						<h2 id="home-stats-heading">Din statistik</h2>
						<span class="home-counter">Översikt</span>
					</div>
					<div id="home-stats-content"></div>
				</section>
			</section>
		</section>
	`;
}

export function setupHomePage() {
	const elements = selectHomeElements();
	if (!elements) { return; }

	void (async () => {
		try {
			const dashboard = await getHomeDashboardData();
			const session = dashboard?.session;
			const isAuthenticated = Boolean(dashboard?.isAuthenticated);

			if (!isAuthenticated) {
				renderGuestState(elements);
				return;
			}

			const profile = await getMyProfile();
			const displayName = resolveDisplayName({ profile, session }) || "vän";
			renderAuthenticatedState(elements, { displayName, dashboard });
		} catch {
			renderErrorState(elements);
		}
	})();
}
