import { navigateTo } from "../../router/router.js";
import {
	addShoppingListItem,
	deleteListItem,
	getShoppingList,
	getShoppingListItems,
	getStoreLayouts,
	getStores,
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
	isSearchingProducts: false,
	suggestions: [],
	dismissedSuggestionIds: new Set(),
	expandedNotesItemId: null,
	noteDraftByItemId: new Map(),
	searchDebounceTimer: null,
	noteSaveTimers: new Map(),
	stores: [],
	storeLayouts: [],
	selectedStoreId: "",
	selectedLayoutId: "",
	isStoreEditorOpen: false,
	isStoreEditorSaving: false,
	storeEditorError: "",
};

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

	if (state.searchDebounceTimer) {
		clearTimeout(state.searchDebounceTimer);
		state.searchDebounceTimer = null;
	}

	for (const timer of state.noteSaveTimers.values()) {
		clearTimeout(timer);
	}

	state.noteSaveTimers.clear();
	state.isStoreEditorOpen = false;
	state.isStoreEditorSaving = false;
	state.storeEditorError = "";
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

		const categoryName = item.category_name || "Ovrigt";

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

function renderProductSearchResults() {
	const container = document.querySelector("#list-product-search-results");
	const searchInput = document.querySelector("#list-product-search");

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
		container.innerHTML = '<p class="list-page__status">Soker produkter...</p>';
		return;
	}

	if (!state.searchQuery.trim()) {
		container.hidden = true;
		setExpanded(false);
		container.innerHTML = "";
		return;
	}

	const normalizedQuery = state.searchQuery.trim().toLocaleLowerCase("sv");
	const hasExactProductMatch = state.searchResults.some(
		(product) => String(product.name ?? "").trim().toLocaleLowerCase("sv") === normalizedQuery,
	);
	const showCustomOption = !hasExactProductMatch;

	const options = [
		...state.searchResults.map((product) => ({
			id: `product-${product.id}`,
			type: "product",
			label: product.name,
			productId: product.id,
		})),
		...(showCustomOption
			? [{
				id: "custom-option",
				type: "custom",
				label: `Lagg till '${state.searchQuery.trim()}' som Okategoriserat`,
				customName: state.searchQuery.trim(),
			}]
			: []),
	];

	if (options.length === 0) {
		container.hidden = false;
		setExpanded(true);
		container.innerHTML = '<p class="list-page__status">Inga produkter hittades.</p>';
		return;
	}

	container.hidden = false;
	setExpanded(true);
	container.innerHTML = options
		.map(
			(option) => `
				<button
					type="button"
					role="option"
					class="list-page__search-result ${option.type === "custom" ? "list-page__search-result--custom" : ""}"
					data-add-option-type="${escapeHtml(option.type)}"
					data-add-product-id="${option.productId ? escapeHtml(option.productId) : ""}"
					data-add-custom-name="${option.customName ? escapeHtml(option.customName) : ""}"
					aria-label="${escapeHtml(option.label)}"
				>
					${escapeHtml(option.label)}
				</button>
			`,
		)
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

	if (suggestions.length === 0) {
		section.hidden = true;
		section.innerHTML = "";
		return;
	}

	section.hidden = false;
	section.innerHTML = `
		<h2 class="list-page__section-title">Forslag</h2>
		<div class="list-page__suggestions" role="list">
			${suggestions
		.map(
			(product) => `
					<div class="list-page__suggestion-pill" role="listitem">
						<button
							type="button"
							class="list-page__suggestion-add"
							data-add-product-id="${escapeHtml(product.id)}"
							aria-label="Lagg till ${escapeHtml(product.name)}"
						>
							${escapeHtml(product.name)}
						</button>
						<button
							type="button"
							class="list-page__suggestion-dismiss"
							data-dismiss-suggestion-id="${escapeHtml(product.id)}"
							aria-label="Dolj forslag ${escapeHtml(product.name)}"
						>
							x
						</button>
					</div>
				`,
		)
		.join("")}
		</div>
	`;
}

function getItemNoteDraft(item) {
	const draft = state.noteDraftByItemId.get(String(item.id));
	return draft !== undefined ? draft : item.notes;
}

function renderItemRow(item) {
	const isNotesOpen = String(state.expandedNotesItemId) === String(item.id);
	const noteText = escapeHtml(getItemNoteDraft(item));

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
					<span class="list-page__item-name">${escapeHtml(item.display_name)}</span>
				</button>
				<button
					type="button"
					class="list-page__item-delete"
					data-delete-item-id="${escapeHtml(item.id)}"
					aria-label="Ta bort ${escapeHtml(item.display_name)}"
				>
					x
				</button>
			</div>

			${isNotesOpen ? `
				<div class="list-page__note-box">
					<label class="list-page__note-label" for="note-${escapeHtml(item.id)}">Anteckning</label>
					<textarea
						id="note-${escapeHtml(item.id)}"
						class="textarea-field list-page__note-input"
						data-note-item-id="${escapeHtml(item.id)}"
						rows="2"
						placeholder="Lagg till en anteckning..."
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
				<section class="list-page__group card" aria-label="Kategori ${escapeHtml(group.categoryName)}">
					<h2 class="list-page__section-title">${escapeHtml(group.categoryName)}</h2>
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
				<section class="list-page__group card" aria-label="Diverse">
					<h2 class="list-page__section-title">Diverse</h2>
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
			<section class="list-page__group card list-page__group--completed" aria-label="Fardiga varor">
				<h2 class="list-page__section-title">Klara varor</h2>
				<ul class="list-page__items">
					${completedItems.map((item) => renderItemRow(item)).join("")}
				</ul>
			</section>
		`
		: "";

	container.innerHTML = categoryMarkup + diverseMarkup + completedMarkup;
}

function renderTitleAndStore() {
	const storeToggle = document.querySelector("#list-store-toggle");
	const storeLabel = document.querySelector("#list-store-label");
	const storeEditor = document.querySelector("#list-store-editor");
	const storeSelect = document.querySelector("#list-store-select");
	const layoutSelect = document.querySelector("#list-layout-select");
	const saveButton = document.querySelector("#list-store-save");
	const status = document.querySelector("#list-store-editor-status");
	const storeChevron = document.querySelector("#list-store-chevron");

	if (storeLabel) {
		const storeName = state.list?.store?.name || "Okand butik";
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

	if (storeChevron) {
		storeChevron.classList.toggle("is-open", state.isStoreEditorOpen);
	}

	if (storeSelect) {
		storeSelect.innerHTML = state.stores
			.map((store) => {
				const cityPart = store.city ? ` (${store.city})` : "";
				return `<option value="${escapeHtml(store.id)}">${escapeHtml(store.name)}${escapeHtml(cityPart)}</option>`;
			})
			.join("");

		if (state.selectedStoreId) {
			storeSelect.value = String(state.selectedStoreId);
		}
	}

	if (layoutSelect) {
		const createLayoutOption = '<option value="__create_new_layout__">Skapa ny layout...</option>';
		const layoutOptions = state.storeLayouts
			.map((layout) => `<option value="${escapeHtml(layout.id)}">${escapeHtml(layout.name)}</option>`)
			.join("");

		layoutSelect.innerHTML = createLayoutOption + layoutOptions;
		layoutSelect.value = state.selectedLayoutId ? String(state.selectedLayoutId) : "__create_new_layout__";
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
		getSuggestedProducts(state.list, Array.from(state.dismissedSuggestionIds)),
	]);

	state.items = items;
	state.suggestions = suggestions;
}

async function loadListPageData(listId) {
	state.isLoading = true;
	state.loadError = "";
	state.listId = listId;
	renderAll();

	try {
		const list = await getShoppingList(listId);

		if (!list) {
			state.loadError = "Listan kunde inte hittas.";
			state.list = null;
			state.items = [];
			state.suggestions = [];
			return;
		}

		state.list = list;
		state.items = list.items ?? [];
		state.selectedStoreId = String(list.store_id ?? list.store?.id ?? "");
		state.selectedLayoutId = String(list.store_layout_id ?? list.layout?.id ?? "");
		state.stores = await getStores();
		state.storeLayouts = state.selectedStoreId
			? await getStoreLayouts(state.selectedStoreId)
			: [];
		state.suggestions = await getSuggestedProducts(list, Array.from(state.dismissedSuggestionIds));
	} catch (error) {
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
		state.storeEditorError = "Kunde inte spara butik/layout. Forsok igen.";
	} finally {
		state.isStoreEditorSaving = false;
		renderTitleAndStore();
	}
}

function queueProductSearch() {
	if (state.searchDebounceTimer) {
		clearTimeout(state.searchDebounceTimer);
	}

	state.searchDebounceTimer = setTimeout(async () => {
		const query = state.searchQuery.trim();

		if (!query) {
			state.searchResults = [];
			state.isSearchingProducts = false;
			renderProductSearchResults();
			return;
		}

		state.isSearchingProducts = true;
		renderProductSearchResults();

		try {
			state.searchResults = await searchProducts(query);
		} catch (error) {
			console.error("Product search failed", error);
			state.searchResults = [];
		} finally {
			state.isSearchingProducts = false;
			renderProductSearchResults();
		}
	}, 250);
}

async function handleAddProductToList(productId) {
	if (!state.listId) {
		return;
	}

	try {
		await addShoppingListItem(state.listId, { productId });
		await refreshItemsAndSuggestions();
		state.searchQuery = "";
		state.searchResults = [];
		renderAll();

		const searchInput = document.querySelector("#list-product-search");
		if (searchInput) {
			searchInput.focus();
		}
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
		state.searchQuery = "";
		state.searchResults = [];
		renderAll();

		const searchInput = document.querySelector("#list-product-search");
		if (searchInput) {
			searchInput.focus();
		}
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

	item.is_checked = checked;
	renderGroups();

	try {
		await toggleItemChecked(itemId, checked);
		await refreshItemsAndSuggestions();
		renderAll();
	} catch (error) {
		item.is_checked = !checked;
		renderGroups();
		console.error("Toggle item failed", error);
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
	const selectedStore = state.stores.find((store) => String(store.id) === String(state.selectedStoreId));

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
				const { addOptionType, addProductId, addCustomName } = addOptionButton.dataset;

				if (addOptionType === "product" && addProductId) {
					await handleAddProductToList(addProductId);
				}

				if (addOptionType === "custom" && addCustomName) {
					await handleAddCustomItemToList(addCustomName);
				}

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

			const storeSaveButton = target.closest("#list-store-save");
			if (storeSaveButton) {
				await handleStoreEditorSave();
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

			if (target.id === "list-store-select") {
				state.selectedStoreId = target.value;
				await refreshStoreLayoutsForSelectedStore();
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

			if (!(target instanceof HTMLInputElement) || target.id !== "list-product-search") {
				return;
			}

			if (event.key !== "Enter") {
				return;
			}

			event.preventDefault();

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
}

export function renderShoppingListPage(path) {
	queueMicrotask(() => {
		initShoppingListPage(path);
	});

	return `
		<section class="list-page page-container" aria-label="Min Inkoplista">
			<header class="list-page__header" role="banner">
				<button
					type="button"
					id="list-back-button"
					class="list-page__back-button"
					aria-label="Ga tillbaka"
				>
					<i class="ti ti-chevron-left" aria-hidden="true"></i>
				</button>

				<h1 class="list-page__title">Min Inkoplista</h1>
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
						<span class="list-page__store-subheader-value">Okand butik</span>
					</span>
					<i id="list-store-chevron" class="ti ti-chevron-down list-page__store-subheader-chevron" aria-hidden="true"></i>
				</button>
			</div>

			<section id="list-store-editor" class="list-page__store-editor-panel" aria-hidden="true">
				<div class="card list-page__store-editor-card">
				<div class="list-page__store-editor">
					<label for="list-store-select" class="list-page__label">Butik</label>
					<select id="list-store-select" class="input-field list-page__store-select"></select>

					<label for="list-layout-select" class="list-page__label">Layout</label>
					<select id="list-layout-select" class="input-field list-page__store-select"></select>

					<button type="button" id="list-store-save" class="btn btn-primary list-page__store-save">Spara butik och layout</button>
					<p id="list-store-editor-status" class="list-page__status list-page__status--error" aria-live="polite"></p>
				</div>
				</div>
			</section>

			<section class="card list-page__search-card" aria-label="Lagg till vara">
				<label for="list-product-search" class="list-page__label">Sok vara</label>
				<input
					id="list-product-search"
					class="input-field list-page__search-input"
					type="search"
					placeholder="Sok eller lagg till vara..."
					autocomplete="off"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded="false"
					aria-controls="list-product-search-results"
				/>
				<div id="list-product-search-results" class="list-page__search-results" role="listbox" hidden></div>
			</section>

			<section id="list-grouped-items" class="list-page__groups" aria-live="polite"></section>
		</section>
	`;
}
