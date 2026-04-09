import {
	searchStores,
	findOrCreateStore,
	getStoreLayoutsRanked,
	getCurrentUserId,
	createShoppingList,
} from "./api.js";
import { navigateTo } from "../../router/router.js";
import "./create-list.css";

const state = {
	currentStep: "store-selection",
	selectedStore: null,
	selectedLayout: null,
	storeNameQuery: "",
	cityQuery: "",
	rawStoreResults: [],
	storeResults: [],
	hasCompletedSearch: false,
	layouts: [],
	isSearching: false,
	isFindingOrCreatingStore: false,
	isStoreDropdownOpen: false,
	currentUserId: null,
	searchError: "",
	layoutsError: "",
	isCreatingList: false,
	createListError: "",
};

let searchDebounceTimer;
let latestSearchRequestId = 0;
let pageEventController;

function navigateToLayoutEditorWithStorePrefill(listId = null) {
	const storeName = String(
		state.selectedStore?.name
			?? state.storeNameQuery
			?? "",
	).trim();
	const city = String(
		state.selectedStore?.city
			?? state.cityQuery
			?? "",
	).trim();

	const query = new URLSearchParams();

	if (storeName) {
		query.set("storeName", storeName);
	}

	if (city) {
		query.set("city", city);
	}

	if (listId) {
		query.set("listId", String(listId));
	}

	const queryString = query.toString();
	navigateTo(queryString ? `/layout-editor?${queryString}` : "/layout-editor");
}

async function createListAndNavigate(layoutId = null, options = {}) {
	const { redirectToList = true } = options;

	if (!state.selectedStore) {
		return null;
	}

	state.isCreatingList = true;
	state.createListError = "";
	renderLayouts();

	try {
		const listId = await createShoppingList({
			storeId: state.selectedStore.id,
			layoutId,
			userId: state.currentUserId,
				title: "Min Inköpslista",
		});

		if (redirectToList) {
			navigateTo(`/list/${listId}`);
		}

		return listId;
	} catch (error) {
		console.error("Failed to create shopping list", error);
		state.createListError = "Kunde inte skapa listan. Försök igen.";
		return null;
	} finally {
		state.isCreatingList = false;
		renderLayouts();
	}
}

function setFindOrCreateButtonState() {
	const button = document.querySelector("#find-or-create-store-button");

	if (!button) {
		return;
	}

	const hasBothFields = Boolean(state.storeNameQuery.trim() && state.cityQuery.trim());
	const shouldShowCreateStore =
		hasBothFields
		&& state.hasCompletedSearch
		&& state.storeResults.length === 0
		&& !state.isSearching
		&& !state.searchError;

	button.hidden = !shouldShowCreateStore;

	if (state.isFindingOrCreatingStore) {
		button.disabled = true;
		button.textContent = "Skapar butik...";
		return;
	}

	button.disabled = false;
	button.textContent = "Skapa butik";
}

function renderStoreResults() {
	const resultsContainer = document.querySelector("#store-search-results");

	if (!resultsContainer) {
		return;
	}

	if (!state.isStoreDropdownOpen) {
		resultsContainer.hidden = true;
		resultsContainer.innerHTML = "";
		return;
	}

	resultsContainer.hidden = false;

	if (state.searchError) {
		resultsContainer.innerHTML = `<p class="create-list__dropdown-status">${state.searchError}</p>`;
		return;
	}

	if (state.isSearching) {
		resultsContainer.innerHTML = '<p class="create-list__dropdown-status">Söker butiker...</p>';
		return;
	}

	if (state.isFindingOrCreatingStore) {
		resultsContainer.innerHTML =
			'<p class="create-list__dropdown-status">Skapar butik...</p>';
		return;
	}

	if (!state.storeNameQuery.trim() && !state.cityQuery.trim()) {
		resultsContainer.hidden = true;
		resultsContainer.innerHTML = "";
		return;
	}

	if (state.storeResults.length === 0) {
		const hasStoreName = Boolean(state.storeNameQuery.trim());
		const hasCity = Boolean(state.cityQuery.trim());

		if (hasStoreName !== hasCity) {
			const missingField = hasStoreName ? "stad" : "butiksnamn";
			resultsContainer.innerHTML = `<p class="create-list__dropdown-status">Inga matchande butiker hittades. Fyll i även ${missingField} för att skapa en ny butik.</p>`;
			return;
		}

		resultsContainer.innerHTML =
			'<p class="create-list__dropdown-status">Inga matchande butiker hittades.</p>';
		return;
	}

	resultsContainer.innerHTML = state.storeResults
		.map(
			(store) => `
				<button
					type="button"
					data-store-id="${store.id}"
					class="create-list__store-result"
					aria-label="Välj ${store.name} i ${store.city}"
				>
					<span class="create-list__store-result-name">${store.name}</span>
					<span class="create-list__store-result-meta">${store.city}</span>
				</button>
			`,
		)
		.join("");
}

function sortLayoutsForDisplay(layouts) {
	const currentUserId = state.currentUserId;

	return [...layouts].sort((a, b) => {
		const aIsOwned = currentUserId && a.created_by === currentUserId ? 1 : 0;
		const bIsOwned = currentUserId && b.created_by === currentUserId ? 1 : 0;

		if (aIsOwned !== bIsOwned) {
			return bIsOwned - aIsOwned;
		}

		return Number(b.usage_count ?? 0) - Number(a.usage_count ?? 0);
	});
}

function getLayoutAuthorLabel(layout) {
	if (!layout) {
		return "Okänd skapare";
	}

	const authorName = String(layout.author_name ?? "").trim();
	if (authorName) {
		return authorName;
	}

	return "Okänd skapare";
}

function getLayoutDisplayLabel(layout) {
	const authorLabel = getLayoutAuthorLabel(layout);

	if (authorLabel === "Okänd skapare") {
		return "Okänd skapares layout";
	}

	return `${authorLabel}s layout`;
}

function renderLayouts() {
	const wrapper = document.querySelector("#layout-list-wrapper");
	const list = document.querySelector("#layout-list");
	const selectedStoreName = document.querySelector("#selected-store-name");
	const selectedLayoutSummary = document.querySelector("#selected-layout-summary");

	if (!wrapper || !list || !selectedStoreName || !selectedLayoutSummary) {
		return;
	}

	if (!state.selectedStore) {
		wrapper.hidden = true;
		selectedStoreName.textContent = "";
		selectedLayoutSummary.textContent = "";
		return;
	}

	wrapper.hidden = false;
	selectedStoreName.textContent = `${state.selectedStore.name} - ${state.selectedStore.city}`;

	if (state.layoutsError) {
		list.innerHTML = `
			<p class="create-list__status-text">${state.layoutsError}</p>
		`;
		selectedLayoutSummary.textContent = "";
		return;
	}

	if (state.isCreatingList) {
		selectedLayoutSummary.textContent = "Skapar inköpslista...";
	} else if (state.createListError) {
		selectedLayoutSummary.textContent = state.createListError;
	}

	if (state.layouts.length === 0) {
		list.innerHTML = `
			<p class="create-list__status-text">Det finns inga layouter för den här butiken än.</p>
			<button
				type="button"
				class="layout-row layout-row--create"
				data-create-layout="true"
				aria-label="Skapa egen layout"
			>
				<span class="layout-row-info">Skapa egen layout</span>
				<span class="layout-row-rating" aria-hidden="true">&rarr;</span>
			</button>
		`;
		selectedLayoutSummary.textContent = "";
		return;
	}

	list.innerHTML =
		state.layouts
			.map(
				(layout) => `
					<button
						type="button"
						class="layout-row ${
						state.selectedLayout && String(state.selectedLayout.id) === String(layout.id)
							? "layout-row--selected"
							: ""
						}"
						data-layout-id="${layout.id}"
						aria-label="Välj ${getLayoutDisplayLabel(layout)}"
					>
						<span class="layout-row-info">${getLayoutDisplayLabel(layout)}</span>
						<span class="layout-row-rating">⭐ ${Number(layout.usage_count ?? 0)}</span>
					</button>
				`,
			)
			.join("") +
		`<button
			type="button"
			class="layout-row layout-row--create"
			data-create-layout="true"
			aria-label="Skapa egen layout"
		>
			<span class="layout-row-info">Skapa egen layout</span>
			<span class="layout-row-rating" aria-hidden="true">&rarr;</span>
		</button>`;

	if (state.selectedLayout) {
		selectedLayoutSummary.textContent = `Vald layout: ${getLayoutDisplayLabel(state.selectedLayout)}`;
	} else {
		selectedLayoutSummary.textContent = "";
	}
}

async function runStoreSearch({ storeName, city }) {
	const requestId = ++latestSearchRequestId;
	state.isSearching = true;
	state.hasCompletedSearch = false;
	state.searchError = "";
	renderStoreResults();
	setFindOrCreateButtonState();

	try {
		const results = await searchStores({ storeName, city });

		if (requestId !== latestSearchRequestId) {
			return;
		}

		state.rawStoreResults = results;
		state.storeResults = [...results];
	} catch {
		if (requestId !== latestSearchRequestId) {
			return;
		}

		state.rawStoreResults = [];
		state.storeResults = [];
		state.searchError = "Kunde inte hämta butiker. Försök igen.";
	}

	if (requestId !== latestSearchRequestId) {
		return;
	}

	state.isSearching = false;
	state.hasCompletedSearch = true;
	renderStoreResults();
	setFindOrCreateButtonState();
}

async function handleStoreSelection(storeId) {
	const selected = state.storeResults.find((store) => String(store.id) === String(storeId));

	if (!selected) {
		return;
	}

	state.selectedStore = selected;
	state.storeNameQuery = String(selected.name ?? "");
	state.cityQuery = String(selected.city ?? "");
	state.selectedLayout = null;
	state.layoutsError = "";
	state.createListError = "";
	state.layouts = [];
	state.isStoreDropdownOpen = false;
	renderStoreResults();
	renderLayouts();

	const storeNameInput = document.querySelector("#store-name-input");
	const cityInput = document.querySelector("#city-input");

	if (storeNameInput) {
		storeNameInput.value = state.storeNameQuery;
	}

	if (cityInput) {
		cityInput.value = state.cityQuery;
	}

	try {
		const rankedLayouts = await getStoreLayoutsRanked(selected.id);
		state.layouts = sortLayoutsForDisplay(rankedLayouts);
	} catch {
		state.layouts = [];
		state.layoutsError = "Kunde inte hämta layouter för den här butiken.";
	}

	renderLayouts();
}

async function loadCurrentUserId() {
	try {
		state.currentUserId = await getCurrentUserId();
	} catch {
		state.currentUserId = null;
	}
}

async function handleFindOrCreateStore() {
	const hasBothFields = Boolean(state.storeNameQuery.trim() && state.cityQuery.trim());

	if (!hasBothFields) {
		state.searchError = "Fyll i både butiksnamn och stad för att skapa en butik.";
		state.isStoreDropdownOpen = true;
		renderStoreResults();
		setFindOrCreateButtonState();
		return;
	}

	state.searchError = "";
	state.isFindingOrCreatingStore = true;
	state.isStoreDropdownOpen = true;
	renderStoreResults();
	setFindOrCreateButtonState();

	try {
		const store = await findOrCreateStore({
			storeName: state.storeNameQuery,
			city: state.cityQuery,
		});

		state.storeResults = [store, ...state.storeResults.filter((item) => item.id !== store.id)];
		await handleStoreSelection(store.id);
	} catch {
		state.searchError = "Kunde inte skapa butik. Försök igen.";
		renderStoreResults();
	} finally {
		state.isFindingOrCreatingStore = false;
		renderStoreResults();
		setFindOrCreateButtonState();
	}
}

function initCreateListPage() {
	if (pageEventController) {
		pageEventController.abort();
	}

	pageEventController = new AbortController();
	const { signal } = pageEventController;

	const pageRoot = document.querySelector(".create-list");
	const searchSection = document.querySelector(".create-list__search");
	const backButton = document.querySelector("#create-list-back-button");
	const storeNameInput = document.querySelector("#store-name-input");
	const cityInput = document.querySelector("#city-input");
	const findOrCreateButton = document.querySelector("#find-or-create-store-button");
	const resultsContainer = document.querySelector("#store-search-results");
	const layoutList = document.querySelector("#layout-list");

	if (
		!pageRoot ||
		!searchSection ||
		!backButton ||
		!storeNameInput ||
		!cityInput ||
		!findOrCreateButton ||
		!resultsContainer ||
		!layoutList
	) {
		return;
	}

	const handleStoreInputChanged = () => {
		state.selectedStore = null;
		state.selectedLayout = null;
		state.layouts = [];
		state.layoutsError = "";
		state.searchError = "";
		state.hasCompletedSearch = false;

		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}

		const hasAnySearchInput = Boolean(state.storeNameQuery.trim() || state.cityQuery.trim());

		if (!hasAnySearchInput) {
			state.rawStoreResults = [];
			state.storeResults = [];
			state.hasCompletedSearch = false;
			state.isSearching = false;
			state.isStoreDropdownOpen = false;
			renderStoreResults();
			renderLayouts();
			setFindOrCreateButtonState();
			return;
		}

		state.isStoreDropdownOpen = true;
		searchDebounceTimer = setTimeout(() => {
			runStoreSearch({
				storeName: state.storeNameQuery,
				city: state.cityQuery,
			});
		}, 300);

		renderLayouts();
		setFindOrCreateButtonState();
	};

	storeNameInput.value = state.storeNameQuery;
	cityInput.value = state.cityQuery;

	storeNameInput.addEventListener(
		"input",
		(event) => {
			state.storeNameQuery = event.target.value;
			handleStoreInputChanged();
		},
		{ signal },
	);

	cityInput.addEventListener(
		"input",
		(event) => {
			state.cityQuery = event.target.value;
			handleStoreInputChanged();
		},
		{ signal },
	);

	backButton.addEventListener(
		"click",
		() => {
			if (window.history.length > 1) {
				window.history.back();
				return;
			}

			navigateTo("/");
		},
		{ signal },
	);

	storeNameInput.addEventListener(
		"focus",
		() => {
			if (state.storeNameQuery.trim() || state.cityQuery.trim()) {
				state.isStoreDropdownOpen = true;
				renderStoreResults();
			}
		},
		{ signal },
	);

	cityInput.addEventListener(
		"focus",
		() => {
			if (state.storeNameQuery.trim() || state.cityQuery.trim()) {
				state.isStoreDropdownOpen = true;
				renderStoreResults();
			}
		},
		{ signal },
	);

	findOrCreateButton.addEventListener(
		"click",
		async () => {
			await handleFindOrCreateStore();
		},
		{ signal },
	);

	resultsContainer.addEventListener(
		"click",
		async (event) => {
			const button = event.target.closest("[data-store-id]");

			if (!button) {
				return;
			}

			await handleStoreSelection(button.dataset.storeId);
		},
		{ signal },
	);

	layoutList.addEventListener(
		"click",
		async (event) => {
			const createLayoutButton = event.target.closest("[data-create-layout]");

			if (createLayoutButton) {
				state.selectedLayout = null;
				state.currentStep = "layout-pending";
				const createdListId = await createListAndNavigate(null, { redirectToList: false });

				if (createdListId) {
					navigateToLayoutEditorWithStorePrefill(createdListId);
				}
				return;
			}

			const useLayoutButton = event.target.closest("[data-layout-id]");

			if (!useLayoutButton) {
				return;
			}

			const layout = state.layouts.find(
				(item) => String(item.id) === String(useLayoutButton.dataset.layoutId),
			);

			if (!layout) {
				return;
			}

			state.selectedLayout = layout;
			state.currentStep = "layout-selected";
			await createListAndNavigate(state.selectedLayout.id);
		},
		{ signal },
	);

	document.addEventListener(
		"click",
		(event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			if (!searchSection.contains(target) && state.isStoreDropdownOpen) {
				state.isStoreDropdownOpen = false;
				renderStoreResults();
			}
		},
		{ signal },
	);

	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape" && state.isStoreDropdownOpen) {
				state.isStoreDropdownOpen = false;
				renderStoreResults();
			}
		},
		{ signal },
	);

	renderStoreResults();
	renderLayouts();
	setFindOrCreateButtonState();
	loadCurrentUserId();
}

export function renderCreateListPage() {
	queueMicrotask(() => {
		initCreateListPage();
	});

	return `
		<section class="create-list create-list-page" aria-label="Skapa inköpslista - välj butik">
			<header class="create-list__nav create-list-header" role="banner">
				<button type="button" id="create-list-back-button" class="create-list__back-button" aria-label="Gå tillbaka">
					<i class="ti ti-chevron-left" aria-hidden="true"></i>
				</button>
				<h1 class="create-list__title">Välj butik</h1>
				<span class="create-list__header-spacer" aria-hidden="true"></span>
			</header>

			<div class="create-list__content page-container--narrow">

				<div class="create-list__search create-list__search-card card create-list-section">
				<div class="create-list__field-group">
					<label class="create-list__label" for="city-input">Stad</label>
					<input
						class="input-field"
						id="city-input"
						type="text"
						placeholder="Exempel: Stadsnamn"
						autocomplete="off"
					/>
				</div>

				<div class="create-list__field-group">
					<label class="create-list__label" for="store-name-input">Butiksnamn</label>
					<input
						class="input-field"
						id="store-name-input"
						type="text"
						placeholder="Exempel: Butiksnamn"
						autocomplete="off"
					/>
				</div>

				<button type="button" id="find-or-create-store-button" class="btn btn-primary create-list__button" hidden>Skapa butik</button>

				<div class="create-list__dropdown" id="store-search-results" aria-live="polite" hidden></div>
			</div>

				<div id="layout-list-wrapper" class="create-list__layouts create-list-section" hidden>
				<h2 class="create-list__section-title">Tillgängliga layouter</h2>
				<p id="selected-store-name" class="create-list__selected-store"></p>
				<div id="layout-list" class="create-list__layout-list layout-list"></div>
				<p id="selected-layout-summary" class="create-list__selected-layout" aria-live="polite"></p>
				</div>
			</div>
		</section>
	`;
}
