import { navigateTo } from "../../router/router.js";
import {
	addShoppingListItem,
	deleteListItem,
	findOrCreateStore,
	getShoppingList,
	getShoppingListItems,
	LIST_ACCESS_ERROR_CODES,
	getStores,
	getStoreLayouts,
	getSuggestedProducts,
	searchProducts,
	toggleItemChecked,
	updateItemNotes,
	updateShoppingListStoreAndLayout,
} from "./api.js";
import "./shopping-list.css";

const state = {
	listId: null,
	list: null,
	items: [],
	isLoading: false,
	loadError: "",
	searchQuery: "",
	searchResults: [],
	searchHighlightedOptionId: "",
	isSearchingProducts: false,
	suggestions: [],
	dismissedSuggestionIds: new Set(),
	expandedNotesItemId: null,
	noteDraftByItemId: new Map(),
	searchDebounceTimer: null,
	noteSaveTimers: new Map(),
	storeLayouts: [],
	allStores: [],
	availableCities: [],
	cityQuery: "",
	filteredCities: [],
	citySearchDebounceTimer: null,
	storeQuery: "",
	storeResults: [],
	filteredStoreResults: [],
	storeSearchDebounceTimer: null,
	selectedStoreId: "",
	selectedLayoutId: "",
	isStoreEditorOpen: false,
	isStoreEditorSaving: false,
	storeEditorError: "",
	isCreatingStore: false,
	newStoreName: "",
	isCreatingStoreLoading: false,
	toggleRequestVersionByItemId: new Map(),
	suggestionsRefreshTimer: null,
	productSearchRequestVersion: 0,
	isSuggestionsCollapsed: false,
};

const MAX_VISIBLE_SEARCH_RESULTS = 6;

let pageEventController;

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function resetTransientState() {
	state.searchQuery = "";
	state.searchResults = [];
	state.isSearchingProducts = false;
	state.expandedNotesItemId = null;
	state.noteDraftByItemId = new Map();
	state.isSuggestionsCollapsed = false;

	if (state.searchDebounceTimer) {
		clearTimeout(state.searchDebounceTimer);
		state.searchDebounceTimer = null;
	}

	for (const timer of state.noteSaveTimers.values()) {
		clearTimeout(timer);
	}

	state.noteSaveTimers.clear();

	if (state.citySearchDebounceTimer) {
		clearTimeout(state.citySearchDebounceTimer);
		state.citySearchDebounceTimer = null;
	}

	state.isStoreEditorOpen = false;
	state.isStoreEditorSaving = false;
	state.storeEditorError = "";
	state.toggleRequestVersionByItemId = new Map();

	if (state.suggestionsRefreshTimer) {
		clearTimeout(state.suggestionsRefreshTimer);
		state.suggestionsRefreshTimer = null;
	}
}

function buildAvailableCities(stores) {
	return Array.from(
		new Set(
			(stores ?? [])
				.map((store) => String(store.city ?? "").trim())
				.filter(Boolean),
		),
	).sort((a, b) => a.localeCompare(b, "sv"));
}

function filterCitiesByQuery() {
	const query = String(state.cityQuery ?? "").trim().toLocaleLowerCase("sv");

	if (!query) {
		state.filteredCities = [];
		return;
	}

	state.filteredCities = state.availableCities
		.filter((city) => city.toLocaleLowerCase("sv").includes(query))
		.slice(0, 10);
}

function filterStoresByQuery() {
	const query = String(state.storeQuery ?? "").trim().toLocaleLowerCase("sv");

	if (!query) {
		state.filteredStoreResults = state.storeResults;
		return;
	}

	state.filteredStoreResults = state.storeResults
		.filter((store) => String(store.name ?? "").toLocaleLowerCase("sv").includes(query))
		.slice(0, 50);
}

function findMatchingCity(query) {
	const normalizedQuery = String(query ?? "").trim().toLocaleLowerCase("sv");
	if (!normalizedQuery) {
		return null;
	}

	return state.availableCities.find(
		(city) => city.toLocaleLowerCase("sv") === normalizedQuery,
	);
}

function updateStoresForSelectedCity() {
	const selectedCity = String(state.cityQuery ?? "").trim();
	const selectedCityNormalized = selectedCity.toLocaleLowerCase("sv");

	state.storeResults = [...(state.allStores ?? [])]
		.filter((store) => {
			if (!selectedCity) {
				return false;
			}

			return String(store.city ?? "").trim().toLocaleLowerCase("sv") === selectedCityNormalized;
		})
		.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "sv"));

	state.storeQuery = "";
	state.filteredStoreResults = state.storeResults;

	const hasSelectedStoreInCity = state.storeResults.some(
		(store) => String(store.id) === String(state.selectedStoreId),
	);

	if (!hasSelectedStoreInCity) {
		state.selectedStoreId = "";
		state.selectedLayoutId = "";
		state.storeLayouts = [];
	}
}

function getSelectedStore() {
	const selectedId = String(state.selectedStoreId ?? "");

	if (!selectedId) {
		return state.list?.store ?? null;
	}

	const fromResults = [...state.storeResults, ...state.allStores].find(
		(store) => String(store.id) === selectedId,
	);

	if (fromResults) {
		return fromResults;
	}

	if (state.list?.store && String(state.list.store.id) === selectedId) {
		return state.list.store;
	}

	return null;
}

function getCategoryOrderMap() {
	const categoryOrder = state.list?.category_order ?? [];
	const map = new Map();

	for (const row of categoryOrder) {
		const categoryId = row.category_id;

		if (!categoryId && categoryId !== 0) {
			continue;
		}

		map.set(String(categoryId), Number(row.order_index ?? Number.MAX_SAFE_INTEGER));
	}

	return map;
}

function sortItemsByName(items) {
	return [...items].sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"));
}

function buildGroups() {
	const categoryOrderMap = getCategoryOrderMap();
	const groupsByCategoryName = new Map();
	const diverseItems = [];
	const completedItems = [];

	for (const item of state.items) {
		if (item.is_checked) {
			completedItems.push(item);
			continue;
		}

		if (item.is_custom || !item.product_id) {
			diverseItems.push(item);
			continue;
		}

		const categoryName = item.category_name || "Övrigt";

		if (!groupsByCategoryName.has(categoryName)) {
			groupsByCategoryName.set(categoryName, {
				categoryName,
				categoryId: item.category?.id ?? null,
				items: [],
			});
		}

		groupsByCategoryName.get(categoryName).items.push(item);
	}

	const orderedGroups = Array.from(groupsByCategoryName.values())
		.map((group) => ({
			...group,
			items: sortItemsByName(group.items),
			sortOrder: categoryOrderMap.get(String(group.categoryId)) ?? Number.MAX_SAFE_INTEGER,
		}))
		.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) {
				return a.sortOrder - b.sortOrder;
			}

			return a.categoryName.localeCompare(b.categoryName, "sv");
		});

	return {
		categoryGroups: orderedGroups,
		diverseItems: sortItemsByName(diverseItems),
		completedItems: sortItemsByName(completedItems),
	};
}

function buildSearchOptions() {
	const trimmedQuery = state.searchQuery.trim();
	if (!trimmedQuery) {
		return [];
	}

	const normalizedQuery = trimmedQuery.toLocaleLowerCase("sv");
	const limitedResults = state.searchResults.slice(0, MAX_VISIBLE_SEARCH_RESULTS);
	const hasExactProductMatch = limitedResults.some(
		(product) => String(product.name ?? "").trim().toLocaleLowerCase("sv") === normalizedQuery,
	);
	const showCustomOption = !hasExactProductMatch;

	return [
		...limitedResults.map((product) => ({
			id: `product-${product.id}`,
			type: "product",
			label: String(product.name ?? ""),
			productId: product.id,
		})),
		...(showCustomOption
			? [{
				id: "custom-option",
				type: "custom",
				label: `Lägg till \"${trimmedQuery}\" som Okategoriserat`,
				customName: trimmedQuery,
			}]
			: []),
	];
}

function setSearchHighlightedOption(optionId) {
	state.searchHighlightedOptionId = optionId ? String(optionId) : "";

	const searchInput = document.querySelector("#list-product-search");
	if (!searchInput) {
		return;
	}

	if (!state.searchHighlightedOptionId) {
		searchInput.setAttribute("aria-activedescendant", "");
		return;
	}

	searchInput.setAttribute(
		"aria-activedescendant",
		`list-product-search-option-${state.searchHighlightedOptionId}`,
	);
}

async function handleSearchOptionSelection(option) {
	if (!option) {
		return;
	}

	if (option.type === "product" && option.productId) {
		await handleAddProductToList(option.productId);
		return;
	}

	if (option.type === "custom" && option.customName) {
		await handleAddCustomItemToList(option.customName);
	}
}

function renderProductSearchResults() {
	const container = document.querySelector("#list-product-search-results");
	const searchInput = document.querySelector("#list-product-search");
	const searchCard = document.querySelector(".list-page__search-card");

	const setExpanded = (isExpanded) => {
		if (searchInput) {
			searchInput.setAttribute("aria-expanded", isExpanded ? "true" : "false");
		}
	};

	if (!container) {
		return;
	}

	if (state.isSearchingProducts) {
		container.hidden = false;
		setExpanded(true);
		if (searchCard) {
			searchCard.classList.add("list-page__search-card--results-open");
		}
		container.innerHTML = '<p class="list-page__search-results-status">Söker produkter...</p>';
		return;
	}

	if (!state.searchQuery.trim()) {
		container.hidden = true;
		setExpanded(false);
		if (searchCard) {
			searchCard.classList.remove("list-page__search-card--results-open");
		}
		container.innerHTML = "";
		setSearchHighlightedOption("");
		return;
	}

	const options = buildSearchOptions();
	const hasHighlightedOption = options.some(
		(option) => option.id === state.searchHighlightedOptionId,
	);

	if (!hasHighlightedOption && state.searchHighlightedOptionId) {
		setSearchHighlightedOption("");
	}

	if (options.length === 0) {
		container.hidden = false;
		setExpanded(true);
		if (searchCard) {
			searchCard.classList.add("list-page__search-card--results-open");
		}
		container.innerHTML = '<p class="list-page__search-results-status">Inga produkter hittades.</p>';
		return;
	}

	container.hidden = false;
	setExpanded(true);
	if (searchCard) {
		searchCard.classList.add("list-page__search-card--results-open");
	}
	container.innerHTML = options
		.map((option, index) => {
			const isHighlighted = option.id === state.searchHighlightedOptionId;
			const addDivider = option.type === "custom" && index > 0;
			return `
				${addDivider ? '<div class="list-page__search-results-divider" role="presentation"></div>' : ""}
				<button
					type="button"
					id="list-product-search-option-${escapeHtml(option.id)}"
					role="option"
					class="list-page__search-result ${option.type === "custom" ? "list-page__search-result--custom" : ""} ${isHighlighted ? "is-highlighted" : ""}"
					data-add-option-id="${escapeHtml(option.id)}"
					data-add-option-type="${escapeHtml(option.type)}"
					data-add-product-id="${option.productId ? escapeHtml(option.productId) : ""}"
					data-add-custom-name="${option.customName ? escapeHtml(option.customName) : ""}"
					aria-label="${escapeHtml(option.label)}"
					aria-selected="${isHighlighted ? "true" : "false"}"
				>
					${escapeHtml(option.label)}
				</button>
			`;
		})
		.join("");
}

function renderSuggestions() {
	const section = document.querySelector("#list-suggestions-section");

	if (!section) {
		return;
	}

	const suggestions = state.suggestions.filter(
		(product) => !state.dismissedSuggestionIds.has(String(product.id)),
	);
	const visibleSuggestions = suggestions.slice(0, 5);

	if (visibleSuggestions.length === 0) {
		section.hidden = true;
		section.innerHTML = "";
		return;
	}

	section.hidden = false;
	section.innerHTML = `
		<button
			type="button"
			class="list-page__prediction-header"
			data-toggle-suggestions="true"
			aria-expanded="${state.isSuggestionsCollapsed ? "false" : "true"}"
		>
			<span class="list-page__prediction-title">Vanliga varor</span>
			<i class="ti ti-chevron-down list-page__prediction-chevron ${state.isSuggestionsCollapsed ? "is-collapsed" : ""}" aria-hidden="true"></i>
		</button>
		<div class="list-page__suggestions ${state.isSuggestionsCollapsed ? "is-collapsed" : ""}" ${state.isSuggestionsCollapsed ? "hidden" : ""}>
			<ul class="list-page__items list-page__suggestion-items" role="list">
				${visibleSuggestions
		.map(
			(product) => `
					<li class="list-page__suggestion-row" role="listitem">
						<button
							type="button"
							class="list-page__suggestion-add"
							data-add-product-id="${escapeHtml(product.id)}"
							aria-label="Lägg till ${escapeHtml(product.name)}"
						>
							${escapeHtml(product.name)}
						</button>
						<button
							type="button"
							class="list-page__suggestion-dismiss"
							data-dismiss-suggestion-id="${escapeHtml(product.id)}"
							aria-label="Dölj förslag ${escapeHtml(product.name)}"
						>
							<i class="ti ti-x" aria-hidden="true"></i>
						</button>
					</li>
				`,
		)
		.join("")}
			</ul>
		</div>
	`;
}

function getItemNoteDraft(item) {
	const draft = state.noteDraftByItemId.get(String(item.id));
	return draft !== undefined ? draft : item.notes;
}

function renderItemRow(item) {
	const isNotesOpen = String(state.expandedNotesItemId) === String(item.id);
	const noteDraft = String(getItemNoteDraft(item) ?? "");
	const trimmedNote = noteDraft.trim();
	const noteText = escapeHtml(noteDraft);
	const hasNote = Boolean(trimmedNote);
	const notePreview = escapeHtml(trimmedNote);

	return `
		<li class="list-page__item ${item.is_checked ? "list-page__item--checked" : ""}">
			<div class="list-page__item-row">
				<input
					type="checkbox"
					class="checkbox-field list-page__item-checkbox"
					data-item-check-id="${escapeHtml(item.id)}"
					${item.is_checked ? "checked" : ""}
					aria-label="Markera ${escapeHtml(item.display_name)}"
				/>
				<button
					type="button"
					class="list-page__item-main"
					data-expand-notes-id="${escapeHtml(item.id)}"
					aria-expanded="${isNotesOpen ? "true" : "false"}"
				>
					<span class="list-page__item-content">
						<span class="list-page__item-name">${escapeHtml(item.display_name)}</span>
						${hasNote && !isNotesOpen
							? `<span class="list-page__item-note-preview">${notePreview}</span>`
							: ""
						}
					</span>
				</button>
				${isNotesOpen
					? `
						<button
							type="button"
							class="list-page__item-delete"
							data-delete-item-id="${escapeHtml(item.id)}"
							aria-label="Ta bort ${escapeHtml(item.display_name)}"
						>
							<i class="ti ti-trash" aria-hidden="true"></i>
						</button>
					`
					: ""
				}
			</div>

			${isNotesOpen ? `
				<div class="list-page__note-box">
					<label class="list-page__note-label" for="note-${escapeHtml(item.id)}">Anteckning</label>
					<textarea
						id="note-${escapeHtml(item.id)}"
						class="textarea-field list-page__note-input"
						data-note-item-id="${escapeHtml(item.id)}"
						rows="2"
						placeholder="Lägg till en anteckning..."
					>${noteText}</textarea>
				</div>
			` : ""}
		</li>
	`;
}

function renderGroups() {
	const container = document.querySelector("#list-grouped-items");

	if (!container) {
		return;
	}

	if (state.isLoading) {
		container.innerHTML = '<p class="list-page__status">Laddar lista...</p>';
		return;
	}

	if (state.loadError) {
		container.innerHTML = `<p class="list-page__status list-page__status--error">${escapeHtml(state.loadError)}</p>`;
		return;
	}

	const { categoryGroups, diverseItems, completedItems } = buildGroups();

	const categoryMarkup = categoryGroups
		.map(
			(group) => `
				<section class="list-page__group" aria-label="Kategori ${escapeHtml(group.categoryName)}">
					<h2 class="list-page__section-title"><span>${escapeHtml(group.categoryName)}</span></h2>
					<ul class="list-page__items">
						${group.items.map((item) => renderItemRow(item)).join("")}
					</ul>
				</section>
			`,
		)
		.join("");

	const diverseMarkup = `
		${diverseItems.length > 0
			? `
				<section class="list-page__group" aria-label="Diverse">
					<h2 class="list-page__section-title"><span>Diverse</span></h2>
					<ul class="list-page__items">
						${diverseItems.map((item) => renderItemRow(item)).join("")}
					</ul>
				</section>
			`
			: ""
		}
	`;

	const completedMarkup = completedItems.length > 0
		? `
			<section class="list-page__group list-page__group--completed" aria-label="Färdiga varor">
				<h2 class="list-page__section-title"><span>Klara varor</span></h2>
				<ul class="list-page__items">
					${completedItems.map((item) => renderItemRow(item)).join("")}
				</ul>
			</section>
		`
		: "";

	container.innerHTML = categoryMarkup + diverseMarkup + completedMarkup;
}

function renderTitleAndStore() {
	const titleLabel = document.querySelector("#list-title");
	const storeToggle = document.querySelector("#list-store-toggle");
	if (titleLabel) {
		titleLabel.textContent = String(state.list?.title || "Min Inköpslista");
	}

	const storeLabel = document.querySelector("#list-store-label");
	const storeEditor = document.querySelector("#list-store-editor");
	const storeOverlay = document.querySelector("#list-store-overlay");
	const storeOptionsContainer = document.querySelector("#list-store-options");
	const layoutSelect = document.querySelector("#list-layout-select");
	const createLayoutButton = document.querySelector("#list-create-layout-btn");
	const saveButton = document.querySelector("#list-store-save");
	const status = document.querySelector("#list-store-editor-status");
	const storeChevron = document.querySelector("#list-store-chevron");

	if (storeLabel) {
		const storeName = state.list?.store?.name || "Okänd butik";
		const rawLayoutName = String(state.list?.layout?.name ?? "").trim();
		const isDuplicateLayoutName = rawLayoutName
			&& rawLayoutName.toLocaleLowerCase("sv") === String(storeName).trim().toLocaleLowerCase("sv");
		const layoutSuffix = rawLayoutName && !isDuplicateLayoutName ? ` - ${rawLayoutName}` : "";
		const displayValue = `${storeName}${layoutSuffix}`;

		storeLabel.innerHTML = `
			<span class="list-page__store-subheader-prefix">Byt butik:</span>
			<span class="list-page__store-subheader-value">${escapeHtml(displayValue)}</span>
		`;
	}

	if (storeToggle) {
		storeToggle.setAttribute("aria-expanded", state.isStoreEditorOpen ? "true" : "false");
	}

	if (storeEditor) {
		storeEditor.classList.toggle("is-open", state.isStoreEditorOpen);
		storeEditor.setAttribute("aria-hidden", state.isStoreEditorOpen ? "false" : "true");
	}

	if (storeOverlay) {
		storeOverlay.classList.toggle("is-visible", state.isStoreEditorOpen);
		storeOverlay.setAttribute("aria-hidden", state.isStoreEditorOpen ? "false" : "true");
	}

	if (storeChevron) {
		storeChevron.classList.toggle("is-open", state.isStoreEditorOpen);
	}

	const cityResultsContainer = document.querySelector("#list-store-city-results");
	if (cityResultsContainer) {
		// Check if the current city query matches an available city exactly
		const currentCityMatches = state.availableCities.some(
			(city) => String(city).trim().toLocaleLowerCase("sv") === String(state.cityQuery).trim().toLocaleLowerCase("sv")
		);

		// Show city results if user has typed something and there are matches (but not if they've selected a matching city)
		if (state.filteredCities.length > 0 && !currentCityMatches) {
			cityResultsContainer.hidden = false;
			cityResultsContainer.innerHTML = state.filteredCities
				.map((city) => `
					<button
						type="button"
						class="list-page__city-option"
						data-city-option="${escapeHtml(city)}"
					>
						${escapeHtml(city)}
					</button>
				`)
				.join("");
		} else {
			// Hide results when input is empty or a valid city is selected
			cityResultsContainer.hidden = true;
			cityResultsContainer.innerHTML = "";
		}
	}

	// Update city input field value
	const cityInput = document.querySelector("#list-store-city-input");
	if (cityInput) {
		cityInput.value = String(state.cityQuery ?? "");
	}

	if (storeOptionsContainer) {
		// Only show stores if a city is selected
		if (!state.cityQuery.trim()) {
			storeOptionsContainer.innerHTML = "";
		} else if (state.isCreatingStore) {
			// Show form to create new store
			storeOptionsContainer.innerHTML = `
				<div class="list-page__create-store-form">
					<input
						type="text"
						id="list-new-store-name"
						class="input-field list-page__store-input"
						placeholder="Butikens namn..."
						value="${escapeHtml(state.newStoreName)}"
						${state.isCreatingStoreLoading ? "disabled" : ""}
					/>
					<div class="list-page__create-store-actions">
						<button
							type="button"
							class="btn btn-primary"
							id="list-confirm-create-store"
							${state.isCreatingStoreLoading || !state.newStoreName.trim() ? "disabled" : ""}
						>
							${state.isCreatingStoreLoading ? "Skapar..." : "Skapa butik"}
						</button>
							<button
							type="button"
							class="btn btn-secondary"
							id="list-cancel-create-store"
							${state.isCreatingStoreLoading ? "disabled" : ""}
						>
							Avbryt
						</button>
					</div>
				</div>
			`;
		} else if (state.storeResults.length === 0) {
			storeOptionsContainer.innerHTML = `
				<p class="list-page__status">Inga butiker i denna stad.</p>
				<button type="button" class="btn btn-secondary list-page__create-store-btn" id="list-create-store-btn">
					Skapa ny butik
				</button>
			`;
		} else if (state.storeResults.length > 20) {
			// Large number of stores: show search field + filtered results
			const storeSearchInput = `
				<input
					type="text"
					id="list-store-search"
					class="list-page__store-search"
					placeholder="Sök i butiker..."
					value="${escapeHtml(state.storeQuery)}"
					aria-label="Sök i ${state.storeResults.length} butiker"
				/>
			`;

			const storeResultsCount = state.filteredStoreResults.length;
			const isFiltered = state.storeQuery.trim().length > 0;
			const countLabel = isFiltered
				? `${storeResultsCount} av ${state.storeResults.length} butiker`
				: `${state.storeResults.length} butiker`;

			const storeButtons = state.filteredStoreResults
				.map((store) => {
					const isSelected = String(store.id) === String(state.selectedStoreId);
					return `
						<button
							type="button"
							class="list-page__store-option ${isSelected ? "is-selected" : ""}"
							data-store-option-id="${escapeHtml(store.id)}"
							aria-pressed="${isSelected ? "true" : "false"}"
						>
							<span class="list-page__store-option-name">${escapeHtml(store.name)}</span>
						</button>
					`;
				})
				.join("");

			storeOptionsContainer.innerHTML = storeSearchInput + `<p class="list-page__status-small">${countLabel}</p>` + storeButtons;
		} else {
			// Small number of stores: show all without search
			const storeButtons = state.filteredStoreResults
				.map((store) => {
					const isSelected = String(store.id) === String(state.selectedStoreId);
					return `
						<button
							type="button"
							class="list-page__store-option ${isSelected ? "is-selected" : ""}"
							data-store-option-id="${escapeHtml(store.id)}"
							aria-pressed="${isSelected ? "true" : "false"}"
						>
							<span class="list-page__store-option-name">${escapeHtml(store.name)}</span>
						</button>
					`;
				})
				.join("");

			storeOptionsContainer.innerHTML = storeButtons;
		}
	}

	if (layoutSelect) {
		const hasSelectedStore = Boolean(String(state.selectedStoreId ?? "").trim());
		const hasLayouts = state.storeLayouts.length > 0;

		if (hasLayouts) {
			const createLayoutOption = '<option value="__create_new_layout__">Skapa ny layout...</option>';
			const layoutOptions = state.storeLayouts
				.map((layout) => `<option value="${escapeHtml(layout.id)}">${escapeHtml(layout.name)}</option>`)
				.join("");

			layoutSelect.disabled = false;
			layoutSelect.innerHTML = createLayoutOption + layoutOptions;
			layoutSelect.value = state.selectedLayoutId ? String(state.selectedLayoutId) : "__create_new_layout__";
		} else {
			layoutSelect.disabled = true;
			layoutSelect.innerHTML = '<option value="">Inga layouter i denna butik</option>';
			layoutSelect.value = "";
		}

		if (createLayoutButton) {
			createLayoutButton.hidden = !hasSelectedStore || hasLayouts;
		}
	}

	if (saveButton) {
		saveButton.disabled = state.isStoreEditorSaving || !state.selectedStoreId;
		saveButton.textContent = state.isStoreEditorSaving ? "Sparar..." : "Spara butik och layout";
	}

	if (status) {
		status.textContent = state.storeEditorError;
	}
}

function renderAll() {
	renderTitleAndStore();
	renderProductSearchResults();
	renderSuggestions();
	renderGroups();
}

async function refreshItemsAndSuggestions() {
	if (!state.listId) {
		return;
	}

	const [items, suggestions] = await Promise.all([
		getShoppingListItems(state.listId),
		getSuggestedProducts(
			{ ...(state.list ?? {}), items: state.items },
			Array.from(state.dismissedSuggestionIds),
		),
	]);

	state.items = items;
	state.list = { ...(state.list ?? {}), items };
	state.suggestions = suggestions;
	state.suggestions = state.suggestions.filter(
		(product) => !items.some((item) => String(item.product_id) === String(product.id)),
	);
}

function queueSuggestionsRefresh() {
	if (state.suggestionsRefreshTimer) {
		clearTimeout(state.suggestionsRefreshTimer);
	}

	state.suggestionsRefreshTimer = setTimeout(async () => {
		if (!state.list) {
			return;
		}

		try {
			state.suggestions = await getSuggestedProducts(
				state.list,
				Array.from(state.dismissedSuggestionIds),
			);
			renderSuggestions();
		} catch (error) {
			console.error("Refresh suggestions failed", error);
		}
	}, 300);
}

async function loadListPageData(listId) {
	state.isLoading = true;
	state.loadError = "";
	state.listId = listId;
	renderAll();

	try {
		const [list, stores] = await Promise.all([
			getShoppingList(listId),
			getStores(),
		]);

		if (!list) {
			state.loadError = "Listan kunde inte hittas.";
			state.list = null;
			state.items = [];
			state.suggestions = [];
			return;
		}

		state.list = list;
		state.items = list.items ?? [];
		state.allStores = stores ?? [];
		state.availableCities = buildAvailableCities(state.allStores);
		state.selectedStoreId = String(list.store_id ?? list.store?.id ?? "");
		state.selectedLayoutId = String(list.store_layout_id ?? list.layout?.id ?? "");
		state.cityQuery = String(list.store?.city ?? state.availableCities[0] ?? "");
		updateStoresForSelectedCity();

		if (!state.selectedStoreId && state.storeResults.length === 1) {
			state.selectedStoreId = String(state.storeResults[0].id);
		}

		state.storeLayouts = state.selectedStoreId
			? await getStoreLayouts(state.selectedStoreId)
			: [];
		state.suggestions = await getSuggestedProducts(list, Array.from(state.dismissedSuggestionIds));
	} catch (error) {
		if (error?.code === LIST_ACCESS_ERROR_CODES.UNAUTHENTICATED) {
			navigateTo("/login", { replace: true });
			return;
		}

		if (error?.code === LIST_ACCESS_ERROR_CODES.FORBIDDEN) {
			navigateTo("/", { replace: true });
			return;
		}

		if (error?.code === LIST_ACCESS_ERROR_CODES.NOT_FOUND) {
			state.loadError = "Listan kunde inte hittas.";
			state.list = null;
			state.items = [];
			state.suggestions = [];
			return;
		}

		state.loadError = "Kunde inte ladda listan.";
		console.error("Failed to load shopping list page", error);
	} finally {
		state.isLoading = false;
		renderAll();
	}
}

async function refreshStoreLayoutsForSelectedStore() {
	if (!state.selectedStoreId) {
		state.storeLayouts = [];
		state.selectedLayoutId = "";
		renderTitleAndStore();
		return;
	}

	try {
		state.storeLayouts = await getStoreLayouts(state.selectedStoreId);

		const hasCurrentLayout = state.storeLayouts.some(
			(layout) => String(layout.id) === String(state.selectedLayoutId),
		);

		if (!hasCurrentLayout) {
			state.selectedLayoutId = "";
		}
	} catch (error) {
		console.error("Load store layouts failed", error);
		state.storeLayouts = [];
		state.selectedLayoutId = "";
	}

	renderTitleAndStore();
}

async function handleCitySelection(cityName) {
		state.cityQuery = String(cityName ?? "").trim();
		state.filteredCities = [];
		state.storeEditorError = "";
		updateStoresForSelectedCity();
		renderTitleAndStore();
	}

	async function handleStoreSelection(storeId) {
	const selected = state.storeResults.find((store) => String(store.id) === String(storeId));

	if (!selected) {
		return;
	}

	state.selectedStoreId = String(selected.id);
	state.cityQuery = String(selected.city ?? "");

	await refreshStoreLayoutsForSelectedStore();
}

async function handleStoreEditorSave() {
	if (!state.listId || !state.selectedStoreId) {
		return;
	}

	state.isStoreEditorSaving = true;
	state.storeEditorError = "";
	renderTitleAndStore();

	try {
		await updateShoppingListStoreAndLayout(state.listId, {
			storeId: state.selectedStoreId,
			layoutId: state.selectedLayoutId || null,
		});

		await loadListPageData(state.listId);
		state.isStoreEditorOpen = false;
		renderAll();
	} catch (error) {
		console.error("Update store/layout failed", error);
		state.storeEditorError = "Kunde inte spara butik/layout. Försök igen.";
	} finally {
		state.isStoreEditorSaving = false;
		renderTitleAndStore();
	}
}

async function handleCreateStore() {
	if (!state.newStoreName.trim() || !state.cityQuery.trim()) {
		state.storeEditorError = "Butikens namn och stad är obligatoriska.";
		renderTitleAndStore();
		return;
	}

	state.isCreatingStoreLoading = true;
	state.storeEditorError = "";
	renderTitleAndStore();

	try {
		const newStore = await findOrCreateStore({
			storeName: state.newStoreName.trim(),
			city: state.cityQuery.trim(),
		});

		// Refresh stores list
		const updatedStores = await getStores();
		state.allStores = updatedStores ?? [];

		// Re-filter stores for the selected city
		updateStoresForSelectedCity();

		// Select the newly created store
		state.selectedStoreId = String(newStore.id);
		state.isCreatingStore = false;
		state.newStoreName = "";

		// Load layouts for the new store
		await refreshStoreLayoutsForSelectedStore();
	} catch (error) {
		console.error("Create store failed", error);
		state.storeEditorError = "Kunde inte skapa butik. Försök igen.";
		renderTitleAndStore();
	} finally {
		state.isCreatingStoreLoading = false;
	}
}

function queueProductSearch() {
	if (state.searchDebounceTimer) {
		clearTimeout(state.searchDebounceTimer);
	}

	const requestVersion = ++state.productSearchRequestVersion;

	state.searchDebounceTimer = setTimeout(async () => {
		const query = state.searchQuery.trim();

		if (!query) {
			state.searchResults = [];
			state.searchHighlightedOptionId = "";
			state.isSearchingProducts = false;
			renderProductSearchResults();
			return;
		}

		state.isSearchingProducts = true;
		renderProductSearchResults();

		try {
			const products = await searchProducts(query);

			if (requestVersion !== state.productSearchRequestVersion) {
				return;
			}

			state.searchResults = products;
			state.searchHighlightedOptionId = "";
		} catch (error) {
			if (requestVersion !== state.productSearchRequestVersion) {
				return;
			}

			console.error("Product search failed", error);
			state.searchResults = [];
			state.searchHighlightedOptionId = "";
		}

		if (requestVersion !== state.productSearchRequestVersion) {
			return;
		}

		state.isSearchingProducts = false;
		renderProductSearchResults();
	}, 250);
}

function resetSearchAddItemUI({ keepFocus = true } = {}) {
	state.productSearchRequestVersion += 1;
	state.searchQuery = "";
	state.searchResults = [];
	state.searchHighlightedOptionId = "";
	state.isSearchingProducts = false;

	if (state.searchDebounceTimer) {
		clearTimeout(state.searchDebounceTimer);
		state.searchDebounceTimer = null;
	}

	renderProductSearchResults();

	const searchInput = document.querySelector("#list-product-search");
	if (searchInput) {
		searchInput.value = "";
		searchInput.setAttribute("aria-activedescendant", "");

		if (keepFocus) {
			searchInput.focus();
		}
	}
}

async function handleAddProductToList(productId) {
	if (!state.listId) {
		return;
	}

	try {
		await addShoppingListItem(state.listId, { productId });
		await refreshItemsAndSuggestions();
		resetSearchAddItemUI({ keepFocus: true });
		renderAll();
	} catch (error) {
		console.error("Add item failed", error);
	}
}

async function handleAddCustomItemToList(customName) {
	if (!state.listId) {
		return;
	}

	const trimmedCustomName = String(customName ?? "").trim();

	if (!trimmedCustomName) {
		return;
	}

	try {
		await addShoppingListItem(state.listId, { customName: trimmedCustomName });
		await refreshItemsAndSuggestions();
		resetSearchAddItemUI({ keepFocus: true });
		renderAll();
	} catch (error) {
		console.error("Add custom item failed", error);
	}
}

async function handleCheckboxToggle(event) {
	const checkbox = event.target.closest("[data-item-check-id]");

	if (!checkbox) {
		return;
	}

	const itemId = checkbox.dataset.itemCheckId;
	const checked = Boolean(checkbox.checked);
	const item = state.items.find((listItem) => String(listItem.id) === String(itemId));

	if (!item) {
		return;
	}

	const previousState = {
		is_checked: Boolean(item.is_checked),
		checked_at: item.checked_at ?? null,
	};

	item.is_checked = checked;
	item.checked_at = checked ? new Date().toISOString() : null;
	renderGroups();

	const normalizedItemId = String(itemId);
	const requestVersion = (state.toggleRequestVersionByItemId.get(normalizedItemId) ?? 0) + 1;
	state.toggleRequestVersionByItemId.set(normalizedItemId, requestVersion);

	try {
		await toggleItemChecked(itemId, checked);

		if (state.toggleRequestVersionByItemId.get(normalizedItemId) !== requestVersion) {
			return;
		}

		queueSuggestionsRefresh();
	} catch (error) {
		if (state.toggleRequestVersionByItemId.get(normalizedItemId) !== requestVersion) {
			return;
		}

		item.is_checked = previousState.is_checked;
		item.checked_at = previousState.checked_at;
		renderGroups();
		console.error("Toggle item failed", { itemId: normalizedItemId, checked, error });
	}
}

async function handleDeleteItem(itemId) {
	try {
		await deleteListItem(itemId);
		state.items = state.items.filter((item) => String(item.id) !== String(itemId));
		await refreshItemsAndSuggestions();
		renderAll();
	} catch (error) {
		console.error("Delete item failed", error);
	}
}

function queueNoteAutosave(itemId, noteText) {
	const existingTimer = state.noteSaveTimers.get(String(itemId));

	if (existingTimer) {
		clearTimeout(existingTimer);
	}

	const timer = setTimeout(async () => {
		try {
			await updateItemNotes(itemId, noteText);

			const item = state.items.find((listItem) => String(listItem.id) === String(itemId));
			if (item) {
				item.notes = noteText;
			}
		} catch (error) {
			console.error("Update note failed", error);
		}
	}, 350);

	state.noteSaveTimers.set(String(itemId), timer);
}

function extractListId(path) {
	const match = /^\/list\/([^/]+)\/?$/.exec(path);
	return match ? decodeURIComponent(match[1]) : null;
}

function navigateToLayoutEditorWithStorePrefill() {
	const selectedStore = getSelectedStore();

	if (!selectedStore) {
		navigateTo("/layout-editor");
		return;
	}

	const query = new URLSearchParams({
		storeName: String(selectedStore.name ?? ""),
		city: String(selectedStore.city ?? ""),
	});

	navigateTo(`/layout-editor?${query.toString()}`);
}

function initShoppingListPage(path) {
	if (pageEventController) {
		pageEventController.abort();
	}

	pageEventController = new AbortController();
	const { signal } = pageEventController;

	const listId = extractListId(path);

	if (!listId) {
		state.loadError = "Ogiltig listadress.";
		state.isLoading = false;
		renderGroups();
		return;
	}

	resetTransientState();
	loadListPageData(listId);

	const pageRoot = document.querySelector(".list-page");

	if (!pageRoot) {
		return;
	}

	pageRoot.addEventListener(
		"click",
		async (event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			const backButton = target.closest("#list-back-button");
			if (backButton) {
				navigateTo("/");
				return;
			}

			const addOptionButton = target.closest("[data-add-option-type]");
			if (addOptionButton) {
				const { addOptionType, addProductId, addCustomName, addOptionId } = addOptionButton.dataset;

				await handleSearchOptionSelection({
					id: addOptionId,
					type: addOptionType,
					productId: addProductId,
					customName: addCustomName,
				});

				return;
			}

			const addProductButton = target.closest("[data-add-product-id]:not([data-add-option-type])");
			if (addProductButton) {
				const { addProductId } = addProductButton.dataset;
				if (addProductId) {
					await handleAddProductToList(addProductId);
				}
				return;
			}

			const dismissSuggestionButton = target.closest("[data-dismiss-suggestion-id]");
			if (dismissSuggestionButton) {
				const { dismissSuggestionId } = dismissSuggestionButton.dataset;

				if (dismissSuggestionId) {
					state.dismissedSuggestionIds.add(String(dismissSuggestionId));
					renderSuggestions();
				}
				return;
			}

			const toggleSuggestionsButton = target.closest("[data-toggle-suggestions]");
			if (toggleSuggestionsButton) {
				state.isSuggestionsCollapsed = !state.isSuggestionsCollapsed;
				renderSuggestions();
				return;
			}

			const deleteButton = target.closest("[data-delete-item-id]");
			if (deleteButton) {
				const { deleteItemId } = deleteButton.dataset;

				if (deleteItemId) {
					await handleDeleteItem(deleteItemId);
				}
				return;
			}

			const notesButton = target.closest("[data-expand-notes-id]");
			if (notesButton) {
				const { expandNotesId } = notesButton.dataset;

				if (!expandNotesId) {
					return;
				}

				state.expandedNotesItemId = String(state.expandedNotesItemId) === String(expandNotesId)
					? null
					: expandNotesId;

				renderGroups();
			}

			const storeLabelButton = target.closest("#list-store-toggle");
			if (storeLabelButton) {
				state.isStoreEditorOpen = !state.isStoreEditorOpen;
				renderTitleAndStore();
				return;
			}

			const storeOverlayButton = target.closest("#list-store-overlay");
			if (storeOverlayButton && state.isStoreEditorOpen) {
				state.isStoreEditorOpen = false;
				renderTitleAndStore();
				return;
			}

			const storeSaveButton = target.closest("#list-store-save");
			if (storeSaveButton) {
				await handleStoreEditorSave();
				return;
			}

			const createLayoutButton = target.closest("#list-create-layout-btn");
			if (createLayoutButton) {
				navigateToLayoutEditorWithStorePrefill();
				return;
			}

			const storeOptionButton = target.closest("[data-store-option-id]");
			if (storeOptionButton?.dataset.storeOptionId) {
				await handleStoreSelection(storeOptionButton.dataset.storeOptionId);
				return;
			}

			const cityOptionButton = target.closest("[data-city-option]");
			if (cityOptionButton?.dataset.cityOption) {
				await handleCitySelection(cityOptionButton.dataset.cityOption);
				return;
			}

			const createStoreButton = target.closest("#list-create-store-btn");
			if (createStoreButton) {
				state.isCreatingStore = true;
				state.newStoreName = "";
				renderTitleAndStore();
				// Focus on the input field
				setTimeout(() => {
					const input = document.querySelector("#list-new-store-name");
					if (input) input.focus();
				}, 0);
				return;
			}

			const confirmCreateStoreButton = target.closest("#list-confirm-create-store");
			if (confirmCreateStoreButton) {
				await handleCreateStore();
				return;
			}

			const cancelCreateStoreButton = target.closest("#list-cancel-create-store");
			if (cancelCreateStoreButton) {
				state.isCreatingStore = false;
				state.newStoreName = "";
				renderTitleAndStore();
				return;
			}
		},
		{ signal },
	);

	pageRoot.addEventListener(
		"change",
		async (event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			if (target.id === "list-layout-select") {
				if (target.value === "__create_new_layout__") {
					navigateToLayoutEditorWithStorePrefill();
					return;
				}

				state.selectedLayoutId = target.value;
				renderTitleAndStore();
				return;
			}



			await handleCheckboxToggle(event);
		},
		{ signal },
	);

	pageRoot.addEventListener(
		"input",
		(event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			if (target.id === "list-product-search") {
				state.searchQuery = target.value;
				queueProductSearch();
				return;
			}

			if (target.id === "list-store-city-input") {
				state.cityQuery = target.value;
				state.storeEditorError = "";

				// Clear existing debounce timer
				if (state.citySearchDebounceTimer) {
					clearTimeout(state.citySearchDebounceTimer);
				}

				// Check if user input matches any existing city
				const matchingCity = findMatchingCity(state.cityQuery);
				if (matchingCity) {
					// Auto-select matching city and update stores
					state.filteredCities = [];
					updateStoresForSelectedCity();
					renderTitleAndStore();
				} else if (state.cityQuery.trim()) {
					// User has typed something but no exact match yet
					// Still treat it as a city selection and show no stores (for creating new store)
					updateStoresForSelectedCity();
					
					// Debounce the filtering and rendering of city suggestions
					state.citySearchDebounceTimer = setTimeout(() => {
						filterCitiesByQuery();
						renderTitleAndStore();
					}, 150);
				} else {
					// Input is empty - clear everything
					state.filteredCities = [];
					state.storeResults = [];
					state.filteredStoreResults = [];
					state.selectedStoreId = "";
					renderTitleAndStore();
				}
				return;
			}

			if (target.id === "list-store-search") {
				state.storeQuery = target.value;
				state.storeEditorError = "";

				if (state.storeSearchDebounceTimer) {
					clearTimeout(state.storeSearchDebounceTimer);
				}

				state.storeSearchDebounceTimer = setTimeout(() => {
					filterStoresByQuery();
					renderTitleAndStore();
				}, 150);
				return;
			}

			if (target.id === "list-new-store-name") {
				state.newStoreName = target.value;
				
				// Update button disabled state without full re-render (to prevent focus loss)
				const confirmButton = document.querySelector("#list-confirm-create-store");
				if (confirmButton) {
					confirmButton.disabled = !state.newStoreName.trim() || state.isCreatingStoreLoading;
				}
				return;
			}

			const noteInput = target.closest("[data-note-item-id]");
			if (noteInput) {
				const { noteItemId } = noteInput.dataset;

				if (!noteItemId) {
					return;
				}

				state.noteDraftByItemId.set(String(noteItemId), noteInput.value);
				queueNoteAutosave(noteItemId, noteInput.value);
			}
		},
		{ signal },
	);

	pageRoot.addEventListener(
		"keydown",
		async (event) => {
			const target = event.target;

			// Handle Enter on city search to accept unmmatched city as new city
			if (target instanceof HTMLInputElement && target.id === "list-store-city-input") {
				if (event.key === "Enter") {
					event.preventDefault();
					const query = state.cityQuery.trim();
					if (query) {
						// Accept the typed city as a new city
						await handleCitySelection(query);
						// Close city results
						const cityResults = document.querySelector("#list-store-city-results");
						if (cityResults) {
							cityResults.hidden = true;
						}
					}
					return;
				}
			}

			if (!(target instanceof HTMLInputElement) || target.id !== "list-product-search") {
				return;
			}

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				const options = buildSearchOptions();

				if (options.length === 0) {
					return;
				}

				event.preventDefault();

				const currentIndex = options.findIndex(
					(option) => option.id === state.searchHighlightedOptionId,
				);
				const direction = event.key === "ArrowDown" ? 1 : -1;
				const nextIndex = currentIndex === -1
					? (direction > 0 ? 0 : options.length - 1)
					: (currentIndex + direction + options.length) % options.length;

				setSearchHighlightedOption(options[nextIndex].id);
				renderProductSearchResults();
				return;
			}

			if (event.key === "Escape") {
				resetSearchAddItemUI({ keepFocus: true });
				return;
			}

			if (event.key !== "Enter") {
				return;
			}

			event.preventDefault();

			const options = buildSearchOptions();
			const highlightedOption = options.find(
				(option) => option.id === state.searchHighlightedOptionId,
			);

			if (highlightedOption) {
				await handleSearchOptionSelection(highlightedOption);
				return;
			}

			const normalizedQuery = state.searchQuery.trim().toLocaleLowerCase("sv");
			const exactMatch = state.searchResults.find(
				(product) => String(product.name ?? "").trim().toLocaleLowerCase("sv") === normalizedQuery,
			);

			if (exactMatch?.id) {
				await handleAddProductToList(exactMatch.id);
				return;
			}

			if (state.searchQuery.trim()) {
				await handleAddCustomItemToList(state.searchQuery.trim());
			}
		},
		{ signal },
	);

	pageRoot.addEventListener(
		"mousemove",
		(event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			const optionButton = target.closest("[data-add-option-id]");
			if (!optionButton?.dataset.addOptionId) {
				return;
			}

			if (optionButton.dataset.addOptionId === state.searchHighlightedOptionId) {
				return;
			}

			setSearchHighlightedOption(optionButton.dataset.addOptionId);
			renderProductSearchResults();
		},
		{ signal },
	);
}

export function renderShoppingListPage(path) {
	queueMicrotask(() => {
		initShoppingListPage(path);
	});

	return `
		<section class="list-page page-container" aria-label="Min Inköpslista">
			<header class="list-page__header" role="banner">
				<button
					type="button"
					id="list-back-button"
					class="list-page__back-button"
					aria-label="Gå tillbaka"
				>
					<i class="ti ti-chevron-left" aria-hidden="true"></i>
				</button>

				<h1 id="list-title" class="list-page__title">Min Inköpslista</h1>
				<span class="list-page__header-spacer" aria-hidden="true"></span>
			</header>

			<div class="list-page__store-subheader-wrap">
				<button
					type="button"
					id="list-store-toggle"
					class="list-page__store-subheader"
					aria-label="Byt butik"
					aria-expanded="false"
				>
					<span id="list-store-label" class="list-page__store-subheader-text">
						<span class="list-page__store-subheader-prefix">Byt butik:</span>
						<span class="list-page__store-subheader-value">Okänd butik</span>
					</span>
					<i id="list-store-chevron" class="ti ti-chevron-down list-page__store-subheader-chevron" aria-hidden="true"></i>
				</button>
			</div>

			<section id="list-store-editor" class="list-page__store-editor-panel" aria-hidden="true">
				<div class="list-page__store-editor-card">
					<div class="list-page__store-editor">
						<div class="list-page__store-step">
							<label for="list-store-city-input" class="list-page__step-label">Stad</label>
							<input id="list-store-city-input" class="input-field list-page__store-input" type="text" placeholder="Sök stad..." autocomplete="off" />
							<div id="list-store-city-results" class="list-page__city-results" hidden role="listbox" aria-label="Stadlista"></div>
						</div>

						<div class="list-page__store-step">
							<p class="list-page__step-label">Butik</p>
							<div id="list-store-options" class="list-page__store-options" role="listbox" aria-label="Välj butik"></div>
						</div>

						<div class="list-page__store-step">
							<label for="list-layout-select" class="list-page__step-label">Layout</label>
							<select id="list-layout-select" class="input-field list-page__store-select"></select>
							<button type="button" id="list-create-layout-btn" class="btn btn-secondary list-page__create-layout-btn" hidden>
								Skapa ny layout
							</button>
						</div>

						<button type="button" id="list-store-save" class="btn btn-primary list-page__store-save">Spara butik och layout</button>
						<p id="list-store-editor-status" class="list-page__status list-page__status--error" aria-live="polite"></p>
					</div>
				</div>
			</section>

			<button
				type="button"
				id="list-store-overlay"
				class="list-page__store-overlay"
				aria-label="Stäng byt butik"
				aria-hidden="true"
			></button>

			<section class="list-page__search-card" aria-label="Lägg till vara">
				<label for="list-product-search" class="list-page__label">Sök vara</label>
				<input
					id="list-product-search"
					class="input-field list-page__search-input"
					type="search"
					placeholder="Sök eller lägg till vara..."
					autocomplete="off"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded="false"
					aria-controls="list-product-search-results"
				/>
				<div id="list-product-search-results" class="list-page__search-results" role="listbox" hidden></div>
			</section>

			<section id="list-suggestions-section" class="list-page__suggestion-card" aria-label="Vanliga varor" hidden></section>

			<section id="list-grouped-items" class="list-page__groups" aria-live="polite"></section>
		</section>
	`;
}
