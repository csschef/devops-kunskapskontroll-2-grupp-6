import { navigateTo } from "../../router/router.js";
import {
	addShoppingListItem,
	deleteListItem,
	findOrCreateStore,
	getListMembers,
	getListSharingContext,
	getShoppingListItemById,
	getShoppingList,
	getShoppingListItems,
	LIST_ACCESS_ERROR_CODES,
	LIST_SHARE_ERROR_CODES,
	getStores,
	getStoreLayouts,
	getSuggestedProducts,
	inviteListMemberByEmail,
	removeListMember,
	subscribeToShoppingListItems,
	subscribeToShoppingListMeta,
	searchProducts,
	toggleItemChecked,
	updateItemNotes,
	updateShoppingListTitle,
	updateShoppingListStoreAndLayout,
} from "./api.js";

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
	isStoresLoading: false,
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
	isTitleEditing: false,
	isTitleSaving: false,
	titleDraft: "",
	titleError: "",
	activeView: "list",
	shareContext: null,
	shareOwner: null,
	shareMembers: [],
	isShareLoading: false,
	shareError: "",
	shareInviteEmail: "",
	shareInviteError: "",
	shareInviteSuccess: "",
	isShareInviting: false,
	shareRemovingUserId: "",
	unsubscribeRealtimeItems: null,
	unsubscribeRealtimeListMeta: null,
	realtimeConnected: false,
	pollingTimer: null,
	lastRealtimeCommitTimestampByItemId: new Map(),
	listLoadVersion: 0,
};

const MAX_VISIBLE_SEARCH_RESULTS = 6;
const POLLING_INTERVAL_MS = 8000;

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
	state.listLoadVersion += 1;
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
	state.activeView = "list";
	state.shareContext = null;
	state.shareOwner = null;
	state.shareMembers = [];
	state.isShareLoading = false;
	state.shareError = "";
	state.shareInviteEmail = "";
	state.shareInviteError = "";
	state.shareInviteSuccess = "";
	state.isShareInviting = false;
	state.shareRemovingUserId = "";

	if (state.suggestionsRefreshTimer) {
		clearTimeout(state.suggestionsRefreshTimer);
		state.suggestionsRefreshTimer = null;
	}

	if (state.pollingTimer) {
		clearInterval(state.pollingTimer);
		state.pollingTimer = null;
	}

	if (typeof state.unsubscribeRealtimeItems === "function") {
		state.unsubscribeRealtimeItems();
	}

	if (typeof state.unsubscribeRealtimeListMeta === "function") {
		state.unsubscribeRealtimeListMeta();
	}

	state.unsubscribeRealtimeItems = null;
	state.unsubscribeRealtimeListMeta = null;
	state.realtimeConnected = false;
	state.lastRealtimeCommitTimestampByItemId = new Map();
}

function getRealtimeTimestampValue(value) {
	const parsed = Date.parse(String(value ?? ""));
	return Number.isFinite(parsed) ? parsed : 0;
}

function upsertItemById(nextItem) {
	const nextId = String(nextItem?.id ?? "").trim();
	if (!nextId) {
		return false;
	}

	const existingIndex = state.items.findIndex((item) => String(item.id) === nextId);

	if (existingIndex === -1) {
		state.items = [...state.items, nextItem];
		return true;
	}

	state.items = state.items.map((item, index) => (index === existingIndex ? {
		...item,
		...nextItem,
	} : item));

	return true;
}

async function ensureStoresLoaded() {
	if (state.isStoresLoading || state.allStores.length > 0) {
		return;
	}

	state.isStoresLoading = true;
	renderTitleAndStore();

	try {
		state.allStores = await getStores();
		state.availableCities = buildAvailableCities(state.allStores);

		if (!state.cityQuery && state.availableCities.length > 0) {
			state.cityQuery = state.availableCities[0];
		}

		updateStoresForSelectedCity();
	} catch (error) {
		console.error("Load stores failed", error);
	} finally {
		state.isStoresLoading = false;
		renderTitleAndStore();
	}
}

function startPollingFallback() {
	if (state.pollingTimer) {
		return;
	}

	state.pollingTimer = setInterval(async () => {
		if (!state.listId || state.isLoading) {
			return;
		}

		try {
			await refreshItemsAndSuggestions({ includeSuggestions: false });
			renderAll();
		} catch (error) {
			console.error("Polling refresh failed", error);
		}
	}, POLLING_INTERVAL_MS);
}

function stopPollingFallback() {
	if (!state.pollingTimer) {
		return;
	}

	clearInterval(state.pollingTimer);
	state.pollingTimer = null;
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

function getDefaultListTitle() {
	const storeName = String(state.list?.store?.name ?? "").trim();
	const cityName = String(state.list?.store?.city ?? "").trim();

	if (storeName && cityName) {
		return `${storeName}, ${cityName}`;
	}

	if (storeName || cityName) {
		return storeName || cityName;
	}

	return "Min Inköpslista";
}

function getListTitleForDisplay() {
	const storedTitle = String(state.list?.title ?? "").trim();
	return storedTitle || getDefaultListTitle();
}

function openTitleEditor() {
	if (!state.listId || state.isTitleSaving) {
		return;
	}

	state.isTitleEditing = true;
	state.titleError = "";
	state.titleDraft = getListTitleForDisplay();
	renderTitleAndStore();

	queueMicrotask(() => {
		const titleInput = document.querySelector("#list-title-input");
		if (titleInput instanceof HTMLInputElement) {
			titleInput.focus();
			titleInput.select();
		}
	});
}

function closeTitleEditor() {
	state.isTitleEditing = false;
	state.isTitleSaving = false;
	state.titleError = "";
	state.titleDraft = "";
	renderTitleAndStore();
}

async function saveTitleEdit() {
	if (!state.listId || state.isTitleSaving) {
		return;
	}

	const fallbackTitle = getDefaultListTitle();
	const nextTitle = String(state.titleDraft ?? "").trim() || fallbackTitle;
	const currentTitle = getListTitleForDisplay();

	if (nextTitle === currentTitle) {
		closeTitleEditor();
		return;
	}

	state.isTitleSaving = true;
	state.titleError = "";
	renderTitleAndStore();

	try {
		await updateShoppingListTitle(state.listId, nextTitle);
		state.list = {
			...(state.list ?? {}),
			title: nextTitle,
		};
		closeTitleEditor();
	} catch (error) {
		console.error("Update title failed", error);
		state.isTitleSaving = false;
		state.titleError = "Kunde inte spara listnamnet. Försök igen.";
		renderTitleAndStore();
	}
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
				label: `Lägg till "${trimmedQuery}" som Okategoriserat`,
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
		const displayTitle = getListTitleForDisplay();

		if (state.isTitleEditing) {
			titleLabel.innerHTML = `
				<div class="list-page__title-input-wrapper">
					<input
						id="list-title-input"
						class="input-field list-page__title-input"
						type="text"
						value="${escapeHtml(state.titleDraft)}"
						maxlength="80"
						aria-label="Redigera inköpslistans namn"
						${state.isTitleSaving ? "disabled" : ""}
					/>
					<button
						type="button"
						id="list-title-save-btn"
						class="list-page__title-check-btn"
						aria-label="Spara inköpslistans namn"
						${state.isTitleSaving ? "disabled" : ""}
					>
						<i class="ti ti-check" aria-hidden="true"></i>
					</button>
				</div>
				${state.titleError ? `<span class="list-page__title-hint list-page__title-hint--error">${escapeHtml(state.titleError)}</span>` : ""}
			`;
		} else {
			titleLabel.innerHTML = `
				<button
					type="button"
					id="list-title-edit-trigger"
					class="list-page__title-edit-button"
					aria-label="Redigera inköpslistans namn"
				>
					<span class="list-page__title-text">${escapeHtml(displayTitle)}</span>
					<i class="ti ti-pencil list-page__title-edit-icon" aria-hidden="true"></i>
				</button>
			`;
		}
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
		
		// Position overlay to start below the store editor card
		if (state.isStoreEditorOpen) {
			const editorCard = document.querySelector(".list-page__store-editor-card");
			if (editorCard) {
				const rect = editorCard.getBoundingClientRect();
				storeOverlay.style.top = `${rect.bottom}px`;
			} else {
				storeOverlay.style.top = "0px";
			}
		} else {
			storeOverlay.style.top = "0px";
		}
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
		if (state.isStoresLoading) {
			storeOptionsContainer.innerHTML = '<p class="list-page__status">Laddar butiker...</p>';
		} else if (!state.cityQuery.trim()) {
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

function getShareOwnerDisplayName() {
	const ownerName = String(state.shareOwner?.name ?? "").trim();
	if (ownerName) {
		return ownerName;
	}

	const ownerEmail = String(state.shareOwner?.email ?? "").trim();
	if (ownerEmail) {
		return ownerEmail;
	}

	return "Okänd ägare";
}

function getShareMemberDisplayName(member) {
	const profileName = String(member?.profile?.name ?? "").trim();
	if (profileName) {
		return profileName;
	}

	const profileEmail = String(member?.profile?.email ?? "").trim();
	if (profileEmail) {
		return profileEmail;
	}

	return "Inaktiv användare";
}

function mapShareInviteError(error) {
	if (!error?.code) {
		return "Kunde inte bjuda in användaren. Försök igen.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.INVALID_EMAIL) {
		return "Ange en giltig e-postadress.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.USER_NOT_FOUND) {
		return "Ingen användare hittades för den e-postadressen. Be personen skapa konto först.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.ALREADY_MEMBER) {
		return "Användaren är redan medlem i listan.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.OWNER_CANNOT_BE_MEMBER) {
		return "Listägaren är redan medlem i listan.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.NOT_OWNER) {
		return "Endast listägaren kan bjuda in medlemmar.";
	}

	return "Kunde inte bjuda in användaren. Försök igen.";
}

function mapShareRemovalError(error) {
	if (!error?.code) {
		return "Kunde inte ta bort medlemmen. Försök igen.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.CANNOT_REMOVE_OWNER) {
		return "Listägaren kan inte tas bort.";
	}

	if (error.code === LIST_SHARE_ERROR_CODES.NOT_OWNER) {
		return "Endast listägaren kan ta bort medlemmar.";
	}

	return "Kunde inte ta bort medlemmen. Försök igen.";
}

function renderShareManagement() {
	const shareSection = document.querySelector("#list-share-management");
	if (!shareSection) {
		return;
	}

	const isShareView = state.activeView === "share";
	shareSection.hidden = !isShareView;

	if (!isShareView) {
		shareSection.innerHTML = "";
		return;
	}

	if (state.isShareLoading) {
		shareSection.innerHTML = '<p class="list-page__status">Laddar delningsinställningar...</p>';
		return;
	}

	if (state.shareError) {
		shareSection.innerHTML = `<p class="list-page__status list-page__status--error">${escapeHtml(state.shareError)}</p>`;
		return;
	}

	const isOwner = Boolean(state.shareContext?.isOwner);
	const ownerName = getShareOwnerDisplayName();
	const ownerEmail = String(state.shareOwner?.email ?? "").trim();
	const membersMarkup = state.shareMembers.length
		? state.shareMembers.map((member) => {
			const memberId = String(member.user_id ?? "");
			const memberName = getShareMemberDisplayName(member);
			const memberEmail = String(member?.profile?.email ?? "").trim();
			const isRemoving = state.shareRemovingUserId === memberId;

			return `
				<li class="list-page__member-row">
					<div class="list-page__member-main">
						<span class="list-page__member-name">${escapeHtml(memberName)}</span>
						<span class="list-page__member-meta">${escapeHtml(memberEmail || "E-post saknas")}</span>
					</div>
					${isOwner
						? `
							<button
								type="button"
								class="btn btn-secondary list-page__member-remove"
								data-share-remove-member-id="${escapeHtml(memberId)}"
								${isRemoving ? "disabled" : ""}
							>
								${isRemoving ? "Tar bort..." : "Ta bort"}
							</button>
						`
						: ""
					}
				</li>
			`;
		}).join("")
		: '<li class="list-page__member-empty">Inga medlemmar tillagda än.</li>';

	shareSection.innerHTML = `
		<section class="card list-page__share-panel">
			<h2 class="list-page__section-title"><span>Medlemmar</span></h2>
			<ul class="list-page__members" role="list">
				<li class="list-page__member-row list-page__member-row--owner">
					<div class="list-page__member-main">
						<span class="list-page__member-name">${escapeHtml(ownerName)}</span>
						<span class="list-page__member-meta">${escapeHtml(ownerEmail || "E-post saknas")}</span>
					</div>
					<span class="status-badge status-info">Ägare</span>
				</li>
				${membersMarkup}
			</ul>
		</section>

		<section class="card list-page__share-panel">
			<h2 class="list-page__section-title"><span>Bjud in via e-post</span></h2>
			<p class="list-page__status">
				${isOwner
					? "Personen måste redan ha ett konto för att kunna läggas till i listan."
					: "Endast listägaren kan bjuda in och ta bort medlemmar."
				}
			</p>
			<form id="list-share-invite-form" class="list-page__share-invite-form" novalidate>
				<div class="list-page__share-invite-row">
					<input
						id="list-share-email-input"
						class="input-field"
						type="email"
						placeholder="name@example.com"
						autocomplete="email"
						value="${escapeHtml(state.shareInviteEmail)}"
						${isOwner ? "" : "disabled"}
						required
					/>
					<button
						type="submit"
						class="btn btn-primary"
						${isOwner && !state.isShareInviting ? "" : "disabled"}
					>
							${state.isShareInviting ? "Bjuder in..." : "Bjud in"}
					</button>
				</div>
			</form>
			${state.shareInviteError
				? `<p class="list-page__status list-page__status--error" aria-live="polite">${escapeHtml(state.shareInviteError)}</p>`
				: ""
			}
			${state.shareInviteSuccess
				? `<p class="list-page__status list-page__status--success" aria-live="polite">${escapeHtml(state.shareInviteSuccess)}</p>`
				: ""
			}
		</section>
	`;
}

async function refreshSharingData() {
	if (!state.listId) {
		return;
	}

	state.isShareLoading = true;
	state.shareError = "";
	renderShareManagement();

	try {
		const [shareContext, membersResult] = await Promise.all([
			getListSharingContext(state.listId),
			getListMembers(state.listId),
		]);

		state.shareContext = shareContext;
		state.shareOwner = membersResult.owner;
		state.shareMembers = membersResult.members;
	} catch (error) {
		if (error?.code === LIST_ACCESS_ERROR_CODES.UNAUTHENTICATED) {
			navigateTo("/login", { replace: true });
			return;
		}

		if (error?.code === LIST_ACCESS_ERROR_CODES.FORBIDDEN) {
			navigateTo("/", { replace: true });
			return;
		}

		state.shareError = "Kunde inte ladda listans medlemmar.";
		console.error("Load share data failed", error);
	} finally {
		state.isShareLoading = false;
		renderShareManagement();
	}
}

function setActiveView(nextView) {
	const normalizedView = nextView === "share" ? "share" : "list";

	if (state.activeView === normalizedView) {
		return;
	}

	state.activeView = normalizedView;
	state.shareInviteError = "";
	state.shareInviteSuccess = "";
	renderAll();

	if (state.activeView === "share") {
		void refreshSharingData();
	}
}

async function handleShareInviteSubmit() {
	if (!state.listId || state.isShareInviting) {
		return;
	}

	state.isShareInviting = true;
	state.shareInviteError = "";
	state.shareInviteSuccess = "";
	renderShareManagement();

	try {
		await inviteListMemberByEmail(state.listId, state.shareInviteEmail);
		state.shareInviteEmail = "";
		state.shareInviteSuccess = "Användaren är nu medlem i listan.";
		await refreshSharingData();
	} catch (error) {
		state.shareInviteError = mapShareInviteError(error);
		console.error("Invite member failed", error);
	} finally {
		state.isShareInviting = false;
		renderShareManagement();
	}
}

async function handleShareMemberRemoval(memberUserId) {
	if (!state.listId) {
		return;
	}

	const normalizedUserId = String(memberUserId ?? "").trim();
	if (!normalizedUserId) {
		return;
	}

	state.shareRemovingUserId = normalizedUserId;
	state.shareInviteError = "";
	state.shareInviteSuccess = "";
	renderShareManagement();

	try {
		await removeListMember(state.listId, normalizedUserId);
		state.shareInviteSuccess = "Medlemmen togs bort från listan.";
		await refreshSharingData();
	} catch (error) {
		state.shareInviteError = mapShareRemovalError(error);
		console.error("Remove member failed", error);
	} finally {
		state.shareRemovingUserId = "";
		renderShareManagement();
	}
}

function renderAll() {
	const isShareView = state.activeView === "share";
	const storeWrap = document.querySelector(".list-page__store-subheader-wrap");
	const storePanel = document.querySelector("#list-store-editor");
	const storeOverlay = document.querySelector("#list-store-overlay");
	const searchCard = document.querySelector(".list-page__search-card");
	const suggestionsSection = document.querySelector("#list-suggestions-section");
	const groupsSection = document.querySelector("#list-grouped-items");
	const shareButton = document.querySelector("#list-share-button");

	if (storeWrap) {
		storeWrap.hidden = isShareView;
		storeWrap.style.display = isShareView ? "none" : "";
	}

	if (storePanel) {
		storePanel.hidden = isShareView;
		storePanel.style.display = isShareView ? "none" : "";
	}

	if (storeOverlay) {
		storeOverlay.hidden = isShareView;
		storeOverlay.style.display = isShareView ? "none" : "";
	}

	if (searchCard) {
		searchCard.hidden = isShareView;
		searchCard.style.display = isShareView ? "none" : "";
		searchCard.setAttribute("aria-hidden", isShareView ? "true" : "false");
	}

	if (suggestionsSection) {
		suggestionsSection.hidden = isShareView;
		suggestionsSection.style.display = isShareView ? "none" : "";
	}

	if (groupsSection) {
		groupsSection.hidden = isShareView;
		groupsSection.style.display = isShareView ? "none" : "";
	}

	const shareSection = document.querySelector("#list-share-management");
	if (shareSection) {
		shareSection.style.display = isShareView ? "flex" : "none";
	}

	if (shareButton) {
		shareButton.setAttribute("aria-pressed", isShareView ? "true" : "false");
		shareButton.innerHTML = isShareView
			? '<i class="ti ti-list" aria-hidden="true"></i>'
			: '<i class="ti ti-users" aria-hidden="true"></i>';
		shareButton.setAttribute("aria-label", isShareView ? "Visa inköpslista" : "Hantera delning");
	}

	renderTitleAndStore();
	renderProductSearchResults();
	renderSuggestions();
	renderGroups();
	renderShareManagement();
}

async function refreshItemsAndSuggestions({ includeSuggestions = true } = {}) {
	if (!state.listId) {
		return;
	}

	const itemsPromise = getShoppingListItems(state.listId);
	const suggestionsPromise = includeSuggestions
		? getSuggestedProducts(
			{ ...(state.list ?? {}), items: state.items },
			Array.from(state.dismissedSuggestionIds),
		)
		: Promise.resolve(state.suggestions);

	const [items, suggestions] = await Promise.all([itemsPromise, suggestionsPromise]);

	state.items = items;
	state.list = { ...(state.list ?? {}), items };

	if (includeSuggestions) {
		state.suggestions = suggestions.filter(
			(product) => !items.some((item) => String(item.product_id) === String(product.id)),
		);
	}
}

async function refreshSuggestionsInBackground(expectedLoadVersion = state.listLoadVersion) {
	if (!state.list) {
		return;
	}

	try {
		const suggestions = await getSuggestedProducts(
			{ ...(state.list ?? {}), items: state.items },
			Array.from(state.dismissedSuggestionIds),
		);

		if (expectedLoadVersion !== state.listLoadVersion) {
			return;
		}

		state.suggestions = suggestions.filter(
			(product) => !state.items.some((item) => String(item.product_id) === String(product.id)),
		);
		renderSuggestions();
	} catch (error) {
		if (expectedLoadVersion !== state.listLoadVersion) {
			return;
		}

		console.error("Refresh suggestions failed", error);
	}
}

async function handleRealtimeItemChange(payload) {
	if (!state.listId) {
		return;
	}

	const eventType = String(payload?.eventType ?? "");
	const commitTimestamp = getRealtimeTimestampValue(payload?.commit_timestamp);

	if (eventType === "DELETE") {
		const deletedId = String(payload?.old?.id ?? "").trim();
		if (!deletedId) {
			return;
		}

		const beforeLength = state.items.length;
		state.items = state.items.filter((item) => String(item.id) !== deletedId);

		if (state.items.length !== beforeLength) {
			state.list = { ...(state.list ?? {}), items: state.items };
			renderGroups();
			queueSuggestionsRefresh();
		}

		return;
	}

	const updatedItemId = String(payload?.new?.id ?? "").trim();
	if (!updatedItemId) {
		return;
	}

	const previousCommitTimestamp = state.lastRealtimeCommitTimestampByItemId.get(updatedItemId) ?? 0;
	if (commitTimestamp && previousCommitTimestamp && commitTimestamp < previousCommitTimestamp) {
		return;
	}

	if (commitTimestamp) {
		state.lastRealtimeCommitTimestampByItemId.set(updatedItemId, commitTimestamp);
	}

	try {
		const hydratedItem = await getShoppingListItemById(updatedItemId);

		if (!hydratedItem) {
			return;
		}

		if (!upsertItemById(hydratedItem)) {
			return;
		}

		state.list = { ...(state.list ?? {}), items: state.items };
		renderGroups();
		queueSuggestionsRefresh();
	} catch (error) {
		console.error("Realtime item update failed", error);
	}
}

async function handleRealtimeListChange() {
	if (!state.listId) {
		return;
	}

	try {
		const latestList = await getShoppingList(state.listId);

		if (!latestList) {
			return;
		}

		state.list = latestList;
		state.items = latestList.items ?? [];
		state.selectedStoreId = String(latestList.store_id ?? latestList.store?.id ?? "");
		state.selectedLayoutId = String(latestList.store_layout_id ?? latestList.layout?.id ?? "");
		state.cityQuery = String(latestList.store?.city ?? state.cityQuery ?? "");

		if (state.allStores.length > 0) {
			updateStoresForSelectedCity();
		}

		renderAll();
		queueSuggestionsRefresh();
	} catch (error) {
		console.error("Realtime list update failed", error);
	}
}

function startRealtimeSync(listId) {
	if (!listId) {
		startPollingFallback();
		return;
	}

	if (typeof state.unsubscribeRealtimeItems === "function") {
		state.unsubscribeRealtimeItems();
	}

	if (typeof state.unsubscribeRealtimeListMeta === "function") {
		state.unsubscribeRealtimeListMeta();
	}

	state.unsubscribeRealtimeItems = null;
	state.unsubscribeRealtimeListMeta = null;

	state.realtimeConnected = false;
	startPollingFallback();

	const handleRealtimeStatus = (status) => {
		console.info("[list realtime] status", { listId, status });

		if (status === "SUBSCRIBED") {
			state.realtimeConnected = true;
			stopPollingFallback();
			return;
		}

		if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
			state.realtimeConnected = false;
			startPollingFallback();
		}
	};

	state.unsubscribeRealtimeItems = subscribeToShoppingListItems(listId, {
		onInsert: (payload) => {
			void handleRealtimeItemChange(payload);
		},
		onUpdate: (payload) => {
			void handleRealtimeItemChange(payload);
		},
		onDelete: (payload) => {
			void handleRealtimeItemChange(payload);
		},
		onStatus: handleRealtimeStatus,
		onError: (error) => {
			console.error("Realtime item subscription error", error);
		},
	});

	state.unsubscribeRealtimeListMeta = subscribeToShoppingListMeta(listId, {
		onUpdate: () => {
			void handleRealtimeListChange();
		},
		onStatus: handleRealtimeStatus,
		onError: (error) => {
			console.error("Realtime list subscription error", error);
		},
	});
}

function queueSuggestionsRefresh() {
	if (state.suggestionsRefreshTimer) {
		clearTimeout(state.suggestionsRefreshTimer);
	}

	state.suggestionsRefreshTimer = setTimeout(() => {
		void refreshSuggestionsInBackground(state.listLoadVersion);
	}, 300);
}

async function loadListPageData(listId) {
	const loadVersion = state.listLoadVersion + 1;
	state.listLoadVersion = loadVersion;
	state.isLoading = true;
	state.loadError = "";
	state.listId = listId;
	renderAll();

	try {
		const list = await getShoppingList(listId);

		if (loadVersion !== state.listLoadVersion) {
			return;
		}

		if (!list) {
			state.loadError = "Listan kunde inte hittas.";
			state.list = null;
			state.items = [];
			state.suggestions = [];
			return;
		}

		state.list = list;
		state.items = list.items ?? [];
		state.isTitleEditing = false;
		state.isTitleSaving = false;
		state.titleDraft = "";
		state.titleError = "";
		state.selectedStoreId = String(list.store_id ?? list.store?.id ?? "");
		state.selectedLayoutId = String(list.store_layout_id ?? list.layout?.id ?? "");
		state.cityQuery = String(list.store?.city ?? state.cityQuery ?? "");

		if (state.allStores.length > 0) {
			state.availableCities = buildAvailableCities(state.allStores);
			updateStoresForSelectedCity();
		} else {
			state.storeResults = [];
			state.filteredStoreResults = [];
		}

		if (!state.selectedStoreId && state.storeResults.length === 1) {
			state.selectedStoreId = String(state.storeResults[0].id);
		}

		state.storeLayouts = [];
		state.suggestions = [];
		startRealtimeSync(listId);
		void refreshSuggestionsInBackground(loadVersion);
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
		if (loadVersion === state.listLoadVersion) {
			state.isLoading = false;
			renderAll();
		}
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

async function ensureStoreEditorDataReady() {
	await ensureStoresLoaded();

	if (state.selectedStoreId && state.storeLayouts.length === 0) {
		await refreshStoreLayoutsForSelectedStore();
	}
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

function getKnownProductById(productId) {
	const normalizedId = String(productId ?? "");

	return state.searchResults.find((product) => String(product.id) === normalizedId)
		?? state.suggestions.find((product) => String(product.id) === normalizedId)
		?? null;
}

async function handleAddProductToList(productId) {
	if (!state.listId) {
		return;
	}

	try {
		const insertedItem = await addShoppingListItem(state.listId, { productId });
		const hydratedItem = insertedItem?.id ? await getShoppingListItemById(insertedItem.id) : null;

		if (hydratedItem) {
			upsertItemById(hydratedItem);
		} else {
			const product = getKnownProductById(productId);
			upsertItemById({
				...(insertedItem ?? {}),
				shopping_list_id: state.listId,
				product_id: productId,
				product,
				category: null,
				display_name: String(product?.name ?? "Ny vara"),
				category_name: "Diverse",
				is_checked: false,
				notes: "",
				is_custom: false,
			});
		}

		state.list = { ...(state.list ?? {}), items: state.items };
		queueSuggestionsRefresh();
		resetSearchAddItemUI({ keepFocus: true });
		renderGroups();
		renderSuggestions();
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
		const insertedItem = await addShoppingListItem(state.listId, { customName: trimmedCustomName });
		const hydratedItem = insertedItem?.id ? await getShoppingListItemById(insertedItem.id) : null;

		if (hydratedItem) {
			upsertItemById(hydratedItem);
		} else {
			upsertItemById({
				...(insertedItem ?? {}),
				shopping_list_id: state.listId,
				product_id: null,
				product: null,
				category: null,
				display_name: trimmedCustomName,
				category_name: "Diverse",
				is_checked: false,
				notes: "",
				is_custom: true,
			});
		}

		state.list = { ...(state.list ?? {}), items: state.items };
		queueSuggestionsRefresh();
		resetSearchAddItemUI({ keepFocus: true });
		renderGroups();
		renderSuggestions();
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
		state.list = { ...(state.list ?? {}), items: state.items };
		queueSuggestionsRefresh();
		renderGroups();
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

export function initShoppingListPage(path) {
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
				if (state.activeView === "share") {
					setActiveView("list");
					return;
				}

				navigateTo("/");
				return;
			}

			const shareButton = target.closest("#list-share-button");
			if (shareButton) {
				setActiveView(state.activeView === "share" ? "list" : "share");
				return;
			}

			const removeMemberButton = target.closest("[data-share-remove-member-id]");
			if (removeMemberButton?.dataset.shareRemoveMemberId) {
				await handleShareMemberRemoval(removeMemberButton.dataset.shareRemoveMemberId);
				return;
			}

			if (state.activeView === "share") {
				return;
			}

			const editTitleButton = target.closest("#list-title-edit-trigger");
			if (editTitleButton) {
				openTitleEditor();
				return;
			}

		const saveTitleButton = target.closest("#list-title-save-btn");
		if (saveTitleButton) {
			await saveTitleEdit();
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
				const isOpening = !state.isStoreEditorOpen;
				state.isStoreEditorOpen = isOpening;
				renderTitleAndStore();

				if (isOpening) {
					void ensureStoreEditorDataReady();
				}
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

			if (state.activeView === "share") {
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

			if (target.id === "list-share-email-input") {
				state.shareInviteEmail = target.value;
				state.shareInviteError = "";
				state.shareInviteSuccess = "";
				renderShareManagement();
				return;
			}

			if (state.activeView === "share") {
				return;
			}

			if (target.id === "list-product-search") {
				state.searchQuery = target.value;
				queueProductSearch();
				return;
			}

			if (target.id === "list-title-input") {
				state.titleDraft = target.value;
				state.titleError = "";
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
		"submit",
		async (event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			if (target.id !== "list-share-invite-form") {
				return;
			}

			event.preventDefault();
			await handleShareInviteSubmit();
		},
		{ signal },
	);

	pageRoot.addEventListener(
		"keydown",
		async (event) => {
			const target = event.target;

			if (state.activeView === "share") {
				return;
			}

			if (target instanceof HTMLInputElement && target.id === "list-title-input") {
				if (event.key === "Escape") {
					event.preventDefault();
					closeTitleEditor();
					return;
				}
			}

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
		"focusout",
		async (event) => {
			const target = event.target;

			if (!(target instanceof HTMLInputElement) || target.id !== "list-title-input") {
				return;
			}

			if (!state.isTitleEditing || state.isTitleSaving) {
				return;
			}

			const relatedTarget = event.relatedTarget;
			if (relatedTarget instanceof Element && relatedTarget.closest("#list-title")) {
				return;
			}

			await saveTitleEdit();
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
