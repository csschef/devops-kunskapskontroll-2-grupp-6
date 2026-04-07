import { navigateTo } from "../../router/router.js";
import {
	addCustomItem,
	addItemToList,
	deleteListItem,
	getShoppingList,
	getShoppingListItems,
	getSuggestedProducts,
	searchProducts,
	toggleItemChecked,
	updateItemNotes,
	updateShoppingListTitle,
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
	listTitleDraft: "",
	isSavingTitle: false,
	searchDebounceTimer: null,
	titleDebounceTimer: null,
	noteSaveTimers: new Map(),
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

	if (state.titleDebounceTimer) {
		clearTimeout(state.titleDebounceTimer);
		state.titleDebounceTimer = null;
	}

	for (const timer of state.noteSaveTimers.values()) {
		clearTimeout(timer);
	}

	state.noteSaveTimers.clear();
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

	if (!container) {
		return;
	}

	if (state.isSearchingProducts) {
		container.hidden = false;
		container.innerHTML = '<p class="list-page__status">Soker produkter...</p>';
		return;
	}

	if (!state.searchQuery.trim()) {
		container.hidden = true;
		container.innerHTML = "";
		return;
	}

	if (state.searchResults.length === 0) {
		container.hidden = false;
		container.innerHTML = '<p class="list-page__status">Inga produkter hittades.</p>';
		return;
	}

	container.hidden = false;
	container.innerHTML = state.searchResults
		.map(
			(product) => `
				<button
					type="button"
					class="list-page__search-result"
					data-add-product-id="${escapeHtml(product.id)}"
					aria-label="Lagg till ${escapeHtml(product.name)}"
				>
					${escapeHtml(product.name)}
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
		<section class="list-page__group card" aria-label="Diverse">
			<h2 class="list-page__section-title">Diverse</h2>
			<ul class="list-page__items">
				${diverseItems.map((item) => renderItemRow(item)).join("")}
			</ul>
			<form id="list-custom-item-form" class="list-page__custom-form">
				<label for="list-custom-item-input" class="list-page__label">Lagg till egen vara</label>
				<div class="list-page__custom-row">
					<input
						id="list-custom-item-input"
						class="input-field"
						type="text"
						placeholder="Exempel: Strumpor"
						aria-label="Lagg till custom item"
					/>
					<button type="submit" class="btn btn-primary list-page__custom-submit">Lagg till</button>
				</div>
			</form>
		</section>
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
	const titleInput = document.querySelector("#list-title-input");
	const storeLabel = document.querySelector("#list-store-label");

	if (titleInput) {
		titleInput.value = state.listTitleDraft || "Min Inkoplista";
	}

	if (storeLabel) {
		const storeName = state.list?.store?.name || "Okand butik";
		storeLabel.textContent = `Byt butik: ${storeName}`;
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
		state.listTitleDraft = String(list.title ?? "Min Inkoplista");
		state.suggestions = await getSuggestedProducts(list, Array.from(state.dismissedSuggestionIds));
	} catch (error) {
		state.loadError = "Kunde inte ladda listan.";
		console.error("Failed to load shopping list page", error);
	} finally {
		state.isLoading = false;
		renderAll();
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
		await addItemToList(state.listId, productId);
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

async function handleCustomItemSubmit(event) {
	event.preventDefault();

	const input = document.querySelector("#list-custom-item-input");

	if (!input || !state.listId) {
		return;
	}

	const customName = input.value.trim();
	if (!customName) {
		return;
	}

	try {
		await addCustomItem(state.listId, customName);
		input.value = "";
		await refreshItemsAndSuggestions();
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

function queueTitleAutosave() {
	if (!state.listId) {
		return;
	}

	if (state.titleDebounceTimer) {
		clearTimeout(state.titleDebounceTimer);
	}

	state.titleDebounceTimer = setTimeout(async () => {
		const trimmedTitle = state.listTitleDraft.trim() || "Min Inkoplista";

		state.isSavingTitle = true;

		try {
			await updateShoppingListTitle(state.listId, trimmedTitle);

			if (state.list) {
				state.list.title = trimmedTitle;
			}
		} catch (error) {
			console.error("Update title failed", error);
		} finally {
			state.isSavingTitle = false;
		}
	}, 300);
}

function extractListId(path) {
	const match = /^\/list\/([^/]+)\/?$/.exec(path);
	return match ? decodeURIComponent(match[1]) : null;
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
				if (window.history.length > 1) {
					window.history.back();
					return;
				}

				navigateTo("/create-list");
				return;
			}

			const addProductButton = target.closest("[data-add-product-id]");
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
		},
		{ signal },
	);

	pageRoot.addEventListener(
		"change",
		async (event) => {
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

			if (target.id === "list-title-input") {
				state.listTitleDraft = target.value;
				queueTitleAutosave();
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

			if (target.id === "list-custom-item-form") {
				await handleCustomItemSubmit(event);
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
					class="btn btn-secondary btn-small list-page__back-button"
					aria-label="Ga tillbaka"
				>
					<span aria-hidden="true">&larr;</span>
				</button>

				<input
					id="list-title-input"
					class="input-field list-page__title-input"
					type="text"
					value="Min Inkoplista"
					aria-label="Redigera listtitel"
				/>

				<span class="list-page__title-hint">Redigera</span>
			</header>

			<div class="card list-page__store-card">
				<button type="button" class="btn btn-secondary list-page__store-button" id="list-store-label" aria-label="Byt butik">
					Byt butik: Okand butik
				</button>
			</div>

			<section class="card list-page__search-card" aria-label="Produktsok">
				<label for="list-product-search" class="list-page__label">Sok vara</label>
				<input
					id="list-product-search"
					class="input-field list-page__search-input"
					type="search"
					placeholder="Sok vara..."
					autocomplete="off"
				/>
				<div id="list-product-search-results" class="list-page__search-results" hidden></div>
			</section>

			<section id="list-suggestions-section" class="card list-page__suggestion-card" aria-label="Foreslag" hidden></section>

			<section id="list-grouped-items" class="list-page__groups" aria-live="polite"></section>
		</section>
	`;
}
