import { navigateTo } from "../../router/router.js";
import { fetchSectionCategories, findMyLayoutByStoreAndCity, saveStoreLayout } from "./layout-service.js";

const DND_CARD_SELECTOR = ".layout-editor-section-card";
const DND_HANDLE_SELECTOR = ".layout-editor-drag-handle";
const TOUCH_AUTO_SCROLL_EDGE_PX = 140;
const TOUCH_AUTO_SCROLL_MIN_STEP = 10;
const TOUCH_AUTO_SCROLL_MAX_STEP = 42;
const TOUCH_AUTO_SCROLL_SPEED_MULTIPLIER = 0.6;
const TOUCH_AUTO_SCROLL_INTERVAL_MS = 16;
const FULL_CARD_DRAG_MIN_WIDTH = 1920;
let touchDraggedCard = null;
let mouseDraggedCard = null;
let currentDropMarkerElement = null;
let pendingDropTargetList = null;
let pendingDropTargetCard = null;
let touchClientX = 0;
let touchClientY = 0;
let touchAutoScrollIntervalId = null;
let currentTouchAutoScrollStep = 0;
let pageLifecycleAbortController = null;
let activeListMutationObserver = null;
let saveActionIsPending = false;
let existingLayoutConflict = null;
let existingLayoutCheckTimeoutId = null;
let existingLayoutCheckRequestId = 0;
let editModeBaselineFingerprint = "";
const DESKTOP_LAYOUT_MIN_WIDTH = 900;
const DEFAULT_CANCEL_PATH = "/profile";
const SAVE_SUCCESS_REDIRECT_DELAY_MS = 700;
const EXISTING_LAYOUT_CHECK_DEBOUNCE_MS = 280;
const EXISTING_LAYOUT_PROMPT_ID = "layout-editor-existing-layout-prompt";
const EXISTING_LAYOUT_PROMPT_MESSAGE_ID = "layout-editor-existing-layout-message";
const EXISTING_LAYOUT_PROMPT_YES_ID = "layout-editor-existing-layout-yes";
const EXISTING_LAYOUT_PROMPT_NO_ID = "layout-editor-existing-layout-no";

function firstNonEmpty(...values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}

	return "";
}

function parseSectionsValue(rawValue) {
	if (!rawValue) return [];

	const normalizedRawValue = String(rawValue).trim();
	if (!normalizedRawValue) return [];

	if (normalizedRawValue.startsWith("[")) {
		try {
			const parsed = JSON.parse(normalizedRawValue);
			if (Array.isArray(parsed)) {
				return parsed.map((value) => normalizeSectionSlug(value)).filter(Boolean);
			}
		} catch {
			// Faller tillbaka till kommaseparerad tolkning.
		}
	}

	return normalizedRawValue
		.split(",")
		.map((value) => normalizeSectionSlug(value))
		.filter(Boolean);
}

function normalizeReturnPath(rawPath) {
	if (!rawPath) return "";

	try {
		const parsedUrl = new URL(rawPath, window.location.origin);
		if (parsedUrl.origin !== window.location.origin) return "";

		const pathWithSearch = `${parsedUrl.pathname}${parsedUrl.search}`;
		if (!pathWithSearch.startsWith("/")) return "";
		if (pathWithSearch.startsWith("/layout-editor")) return "";

		return pathWithSearch;
	} catch {
		return "";
	}
}

function parseLayoutEditorInitialState() {
	const params = new URLSearchParams(window.location.search);
	const returnTo = normalizeReturnPath(firstNonEmpty(params.get("returnTo"), params.get("from")));
	const sections = parseSectionsValue(firstNonEmpty(params.get("sections"), params.get("layoutSections"), params.get("sectionOrder")));
	const isEditMode = params.get("mode") === "edit" || params.get("isEdit") === "1" || params.has("layoutId") || sections.length > 0;

	return {
		storeName: firstNonEmpty(params.get("storeName"), params.get("store"), params.get("store_name")),
		cityName: firstNonEmpty(params.get("cityName"), params.get("city"), params.get("city_name")),
		sections,
		layoutId: firstNonEmpty(params.get("layoutId"), params.get("id")),
		isEditMode,
		returnTo,
	};
}

const SECTION_LABEL_BY_SLUG = {
	"frukt-gront": "Frukt & Grönt",
	"brod-bakverk": "Bröd & Bakverk",
	"kott-fagel": "Kött & Fågel",
	"fisk-skaldjur": "Fisk & Skaldjur",
	"chark-palagg": "Chark & Pålägg",
	"mejeri-agg": "Mejeri & Ägg",
	"frysvaror": "Frysvaror",
	"torrvaror": "Torrvaror",
	"hygien-hushall": "Hygien & Hushåll",
	"dryck": "Dryck",
	"snacks-godis": "Snacks & Godis",
	"ovrigt": "Övrigt",
};

const SECTION_ICON_BY_SLUG = {
	"frukt-gront": "ti ti-apple",
	"brod-bakverk": "ti ti-bread",
	"kott-fagel": "ti ti-meat",
	"fisk-skaldjur": "ti ti-fish",
	"chark-palagg": "ti ti-sausage",
	"mejeri-agg": "ti ti-milk",
	"frysvaror": "ti ti-snowflake",
	"torrvaror": "ti ti-package",
	"hygien-hushall": "ti ti-spray",
	"dryck": "ti ti-bottle",
	"snacks-godis": "ti ti-candy",
	"ovrigt": "ti ti-tag",
};

// Normaliserar kategorinamnet så jämförelser blir stabila.
function normalizeCategoryKey(name) {
	return String(name || "")
		.toLowerCase()
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

// Normaliserar sektion-slug till ett stabilt format.
function normalizeSectionSlug(value) {
	return String(value || "")
		.toLowerCase()
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[_\s]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

// Returnerar läsbar svensk etikett för sektionens slug.
function getSectionDisplayName(slug) {
	const normalizedSlug = normalizeSectionSlug(slug);
	if (!normalizedSlug) return "";

	if (SECTION_LABEL_BY_SLUG[normalizedSlug]) {
		return SECTION_LABEL_BY_SLUG[normalizedSlug];
	}

	return normalizedSlug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

// Returnerar passande ikonklass baserat på kategorinamn.
function getCategoryIconClass(name) {
	const normalizedSlug = normalizeSectionSlug(name);
	if (SECTION_ICON_BY_SLUG[normalizedSlug]) {
		return SECTION_ICON_BY_SLUG[normalizedSlug];
	}

	const key = normalizeCategoryKey(name);

	if (key.includes("frukt") || key.includes("gront") || key.includes("gronsak")) return "ti ti-apple";
	if (key.includes("kott") || key.includes("fagel") || key.includes("kyckling")) return "ti ti-meat";
	if (key.includes("mejeri")) return "ti ti-milk";
	if (key.includes("brod") || key.includes("bageri")) return "ti ti-bread";
	if (key.includes("frys") || key.includes("fryst")) return "ti ti-snowflake";
	if (key.includes("dryck") || key.includes("dricka")) return "ti ti-bottle";
	if (key.includes("godis") || key.includes("snacks")) return "ti ti-candy";
	if (key.includes("hygien") || key.includes("halsa") || key.includes("vard")) return "ti ti-heart";
	if (key.includes("hushall") || key.includes("stad")) return "ti ti-spray";

	return "ti ti-tag";
}

// Renderar en lista av kategorikort i angiven container.
function renderCategoryCards(container, categories) {
	container.replaceChildren();

	const fragment = document.createDocumentFragment();

	for (const category of categories) {
		const cardElement = createCategoryCardElement(category);
		if (cardElement) {
			fragment.appendChild(cardElement);
		}
	}

	container.appendChild(fragment);
}

// Kontrollerar att elementet är ett dragbart kategorikort.
function isDraggableCard(card) {
	return Boolean(card && card.matches(DND_CARD_SELECTOR) && card.getAttribute("draggable") === "true");
}

// Kontrollerar att dragstart kom från kortets handtag.
function isDragHandleTarget(target) {
	return Boolean(target?.closest(DND_HANDLE_SELECTOR));
}

// På bred desktop med fin pekare tillåts drag från hela kortet.
function isWholeCardMouseDragEnabled() {
	const hasFinePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
	return Boolean(hasFinePointer && window.innerWidth >= FULL_CARD_DRAG_MIN_WIDTH);
}

// Hämtar dragbara kort i listan, exklusive det kort som dras.
function getDraggableCards(list, draggedCard) {
	if (!list) return [];

	return Array.from(list.querySelectorAll(DND_CARD_SELECTOR)).filter((card) => card !== draggedCard && isDraggableCard(card));
}

// Räknar ut vilket kort som är närmast som drop-mål utifrån pekarens Y-position.
function getDropTargetCard(list, pointerY, draggedCard) {
	const cards = getDraggableCards(list, draggedCard);
	let closestCard = null;
	let closestOffset = Number.NEGATIVE_INFINITY;

	for (const card of cards) {
		const rect = card.getBoundingClientRect();
		const offset = pointerY - (rect.top + rect.height / 2);

		if (offset < 0 && offset > closestOffset) {
			closestOffset = offset;
			closestCard = card;
		}
	}

	return closestCard;
}

// Avgör om listan är inaktiv-listan.
function isInactiveList(list) {
	return Boolean(list && list.id === "layout-editor-inactive-list");
}

// Avgör om en dragning går från aktiv till inaktiv lista.
function isActiveToInactiveMove(targetList, draggedCard) {
	const sourceListId = draggedCard?.parentElement?.id;
	const targetListId = targetList?.id;

	return sourceListId === "layout-editor-active-list" && targetListId === "layout-editor-inactive-list";
}

// Visar eller flyttar drop-markören i aktuell lista.
function setDropMarker(list, targetCard, draggedCard) {
	if (!list) {
		clearDropMarker();
		return;
	}

	if (!currentDropMarkerElement) {
		currentDropMarkerElement = document.createElement("li");
		currentDropMarkerElement.className = "layout-editor-drop-marker";
		currentDropMarkerElement.setAttribute("aria-hidden", "true");
	}

	currentDropMarkerElement.classList.toggle("layout-editor-drop-marker-danger", isActiveToInactiveMove(list, draggedCard));

	if (targetCard) {
		list.insertBefore(currentDropMarkerElement, targetCard);
		return;
	}

	// När man drar från aktiv till inaktiv ska markören visas överst i listan.
	if (isActiveToInactiveMove(list, draggedCard) && isInactiveList(list)) {
		list.insertBefore(currentDropMarkerElement, list.firstElementChild || null);
		return;
	}

	list.appendChild(currentDropMarkerElement);
}

// Tar bort drop-markören från DOM.
function clearDropMarker() {
	if (!currentDropMarkerElement) return;
	currentDropMarkerElement.remove();
}

// Sparar nuvarande tänkta drop-target tills släpp sker.
function setPendingDropTarget(list, targetCard) {
	pendingDropTargetList = list || null;
	pendingDropTargetCard = targetCard || null;
}

// Nollställer sparad drop-target.
function clearPendingDropTarget() {
	pendingDropTargetList = null;
	pendingDropTargetCard = null;
}

// Slutför flytten av ett kort till sparad drop-target.
function commitPendingDrop(draggedCard) {
	if (!isDraggableCard(draggedCard)) return;

	const list = pendingDropTargetList;
	if (!list) return;

	if (currentDropMarkerElement && currentDropMarkerElement.parentElement === list) {
		list.insertBefore(draggedCard, currentDropMarkerElement);
		return;
	}

	if (isInactiveList(list)) {
		if (draggedCard.parentElement !== list) {
			list.appendChild(draggedCard);
		}
		return;
	}

	const targetCard = pendingDropTargetCard;

	if (!targetCard || targetCard === draggedCard) {
		list.appendChild(draggedCard);
		return;
	}

	if (draggedCard.parentElement === list) {
		const draggableCards = getDraggableCards(list, null);
		const draggedIndex = draggableCards.indexOf(draggedCard);
		const targetIndex = draggableCards.indexOf(targetCard);

		if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex < targetIndex) {
			list.insertBefore(draggedCard, targetCard.nextElementSibling);
			return;
		}
	}

	list.insertBefore(draggedCard, targetCard);
}

// Returnerar true om drop inte skulle ändra något.
function isNoOpDropTarget(list, targetCard, draggedCard) {
	if (!list || !isDraggableCard(draggedCard)) return true;

	if (isInactiveList(list)) {
		return draggedCard.parentElement === list;
	}

	// För aktiv-listan tillåter vi alltid omordningsförsök.
	// Tidigare no-op-filter kunde feltolka giltiga drag och blockera drop-state.
	return false;
}

// Uppdaterar drop-state och visar markör endast vid verklig förändring.
function updateDropTargetState(list, targetCard, draggedCard) {
	if (isNoOpDropTarget(list, targetCard, draggedCard)) {
		clearDropMarker();
		clearPendingDropTarget();
		return;
	}

	setDropMarker(list, targetCard, draggedCard);
	setPendingDropTarget(list, targetCard);
}

// Startar mus-drag och initierar drag-state.
function handleCardDragStart(event) {
	const card = event.target.closest(DND_CARD_SELECTOR);
	if (!isDraggableCard(card)) return;
	if (!isWholeCardMouseDragEnabled() && !isDragHandleTarget(event.target)) {
		event.preventDefault();
		return;
	}

	mouseDraggedCard = card;
	card.classList.add("is-dragging");
	clearDropMarker();
	clearPendingDropTarget();

	event.dataTransfer.effectAllowed = "move";
	event.dataTransfer.setData("text/plain", card.dataset.sectionName || "");
}

// Avslutar mus-drag och städar drag-state.
function handleCardDragEnd(event) {
	const card = event.target.closest(DND_CARD_SELECTOR);
	if (!card) return;
	card.classList.remove("is-dragging");
	mouseDraggedCard = null;
	clearDropMarker();
	clearPendingDropTarget();
}

// Hanterar drag-over för mus och uppdaterar aktuell drop-position.
function handleListDragOver(event) {
	const list = event.currentTarget;
	const draggedCard = mouseDraggedCard;

	if (!isDraggableCard(draggedCard)) return;
	if (isInactiveList(list) && draggedCard.parentElement === list) return;

	event.preventDefault();
	const targetCard = isInactiveList(list) ? null : getDropTargetCard(list, event.clientY, draggedCard);
	updateDropTargetState(list, targetCard, draggedCard);
}

// Hanterar släpp med mus och committar vald position.
function handleListDrop(event) {
	const list = event.currentTarget;
	const draggedCard = mouseDraggedCard;

	if (!isDraggableCard(draggedCard)) return;

	event.preventDefault();

	// Använd den senast beräknade drop-target från dragover när den finns,
	// eftersom drop-eventets koordinater kan vara opålitliga i vissa desktop-lägen.
	if (pendingDropTargetList !== list) {
		const targetCard = isInactiveList(list) ? null : getDropTargetCard(list, event.clientY, draggedCard);
		updateDropTargetState(list, targetCard, draggedCard);
	}

	commitPendingDrop(draggedCard);
	syncSaveButtonState();
}

// Returnerar den lista som ligger under given skärmposition.
function getListFromPoint(x, y) {
	const element = document.elementFromPoint(x, y);
	if (!element) return null;
	return element.closest("#layout-editor-active-list, #layout-editor-inactive-list");
}

// Låser eller låser upp sidscroll under touch-drag.
function setTouchDragScrollLock(isLocked) {
	document.body.classList.toggle("layout-editor-touch-dragging", Boolean(isLocked));
}

function getPageScroller() {
	return document.scrollingElement || document.documentElement;
}

function applyInstantPageScroll(deltaY) {
	if (!deltaY) return;

	const beforeScrollY = window.scrollY;
	window.scrollBy({ top: deltaY, behavior: "instant" });

	if (window.scrollY === beforeScrollY) {
		const scroller = getPageScroller();
		scroller.scrollTop += deltaY;
	}
}

// Beräknar autoscroll-hastighet nära viewportens kanter.
function getTouchAutoScrollDelta(pointerY) {
	const scaleDelta = (intensity, direction) => {
		const clampedIntensity = Math.min(Math.max(intensity, 0), 1);
		const step = (TOUCH_AUTO_SCROLL_MIN_STEP + (TOUCH_AUTO_SCROLL_MAX_STEP - TOUCH_AUTO_SCROLL_MIN_STEP) * clampedIntensity) * TOUCH_AUTO_SCROLL_SPEED_MULTIPLIER;
		return direction * Math.round(step);
	};

	if (pointerY < TOUCH_AUTO_SCROLL_EDGE_PX) {
		const intensity = (TOUCH_AUTO_SCROLL_EDGE_PX - pointerY) / TOUCH_AUTO_SCROLL_EDGE_PX;
		return scaleDelta(intensity, -1);
	}

	const bottomEdgeStart = window.innerHeight - TOUCH_AUTO_SCROLL_EDGE_PX;
	if (pointerY > bottomEdgeStart) {
		const intensity = (pointerY - bottomEdgeStart) / TOUCH_AUTO_SCROLL_EDGE_PX;
		return scaleDelta(intensity, 1);
	}

	return 0;
}

// Uppdaterar drop-target för pågående touch-drag.
function updateTouchDropTarget(pointerX, pointerY) {
	if (!isDraggableCard(touchDraggedCard)) return;

	const targetList = getListFromPoint(pointerX, pointerY);
	if (!targetList) return;
	if (isInactiveList(targetList) && touchDraggedCard.parentElement === targetList) return;

	const targetCard = isInactiveList(targetList) ? null : getDropTargetCard(targetList, pointerY, touchDraggedCard);
	updateDropTargetState(targetList, targetCard, touchDraggedCard);
}

// Stoppar aktiv auto-scroll-loop för touch-drag.
function stopTouchAutoScroll() {
	if (touchAutoScrollIntervalId) {
		clearInterval(touchAutoScrollIntervalId);
		touchAutoScrollIntervalId = null;
	}

	currentTouchAutoScrollStep = 0;
}

// Kör auto-scroll-loop under touch-drag.
function runTouchAutoScrollTick() {
	if (!isDraggableCard(touchDraggedCard)) {
		stopTouchAutoScroll();
		return;
	}

	if (currentTouchAutoScrollStep === 0) return;

	applyInstantPageScroll(currentTouchAutoScrollStep);
	updateTouchDropTarget(touchClientX, touchClientY);
}

// Startar auto-scroll-loop om den inte redan kör.
function startTouchAutoScroll() {
	if (touchAutoScrollIntervalId) return;
	touchAutoScrollIntervalId = setInterval(runTouchAutoScrollTick, TOUCH_AUTO_SCROLL_INTERVAL_MS);
}

// Initierar touch-drag när användaren börjar dra ett kort.
function handleListTouchStart(event) {
	if (!isDragHandleTarget(event.target)) return;

	const card = event.target.closest(DND_CARD_SELECTOR);
	if (!isDraggableCard(card)) return;
	event.preventDefault();
	const touch = event.touches?.[0];
	if (touch) {
		touchClientX = touch.clientX;
		touchClientY = touch.clientY;
		currentTouchAutoScrollStep = getTouchAutoScrollDelta(touchClientY);
	}

	touchDraggedCard = card;
	touchDraggedCard.classList.add("is-dragging");
	setTouchDragScrollLock(true);
	clearDropMarker();
	clearPendingDropTarget();

	startTouchAutoScroll();
}

// Hanterar touch-rörelse under drag och uppdaterar målposition.
function handleDocumentTouchMove(event) {
	if (!isDraggableCard(touchDraggedCard)) return;
	event.preventDefault();

	const touch = event.touches?.[0];
	if (!touch) return;
	touchClientX = touch.clientX;
	touchClientY = touch.clientY;
	currentTouchAutoScrollStep = getTouchAutoScrollDelta(touchClientY);
	updateTouchDropTarget(touchClientX, touchClientY);
	startTouchAutoScroll();
}

// Avslutar touch-drag och återställer temporär state.
function endTouchDragging() {
	if (!touchDraggedCard) return;
	commitPendingDrop(touchDraggedCard);
	syncSaveButtonState();
	touchDraggedCard.classList.remove("is-dragging");
	touchDraggedCard = null;
	touchClientX = 0;
	touchClientY = 0;
	currentTouchAutoScrollStep = 0;
	clearDropMarker();
	clearPendingDropTarget();
	setTouchDragScrollLock(false);
	stopTouchAutoScroll();
}

// Binder touchstart för drag till en lista en gång.
function bindTouchDragAndDrop(list) {
	if (!list || list.dataset.touchDndBound === "true") return;

	list.dataset.touchDndBound = "true";
	list.addEventListener("touchstart", handleListTouchStart, { passive: false });
}

// Sätter upp all touch-baserad drag-and-drop för sidan.
function setupTouchDragAndDrop() {
	const activeList = document.querySelector("#layout-editor-active-list");
	const inactiveList = document.querySelector("#layout-editor-inactive-list");

	bindTouchDragAndDrop(activeList);
	bindTouchDragAndDrop(inactiveList);

	if (!pageLifecycleAbortController) return;

	document.addEventListener("touchmove", handleDocumentTouchMove, { passive: false, signal: pageLifecycleAbortController.signal });
	document.addEventListener("touchend", endTouchDragging, { signal: pageLifecycleAbortController.signal });
	document.addEventListener("touchcancel", endTouchDragging, { signal: pageLifecycleAbortController.signal });
}

// Binder mus-baserad drag-and-drop till en lista en gång.
function bindDragAndDropToList(list) {
	if (!list || list.dataset.dndBound === "true") return;

	list.dataset.dndBound = "true";
	list.addEventListener("dragstart", handleCardDragStart);
	list.addEventListener("dragend", handleCardDragEnd);
	list.addEventListener("dragover", handleListDragOver);
	list.addEventListener("drop", handleListDrop);
}

// Sätter upp all mus-baserad drag-and-drop för sidan.
function setupDragAndDrop() {
	const activeList = document.querySelector("#layout-editor-active-list");
	const inactiveList = document.querySelector("#layout-editor-inactive-list");

	bindDragAndDropToList(activeList);
	bindDragAndDropToList(inactiveList);
}

// Skapar ett kategorikort med DOM-API för att undvika HTML-injektion.
function createCategoryCardElement(slug) {
	const normalizedSlug = normalizeSectionSlug(slug);
	if (!normalizedSlug) return null;
	const iconClass = getCategoryIconClass(normalizedSlug);
	const sectionLabel = getSectionDisplayName(normalizedSlug);
	const card = document.createElement("li");
	const icon = document.createElement("i");
	const label = document.createElement("span");
	const dragHandle = document.createElement("span");

	card.className = "grid-item layout-editor-section-card";
	card.dataset.sectionName = normalizedSlug;
	card.setAttribute("draggable", "true");

	icon.className = `${iconClass} layout-editor-category-icon`;
	icon.setAttribute("aria-hidden", "true");

	label.className = "layout-editor-category-name";
	label.textContent = sectionLabel;

	dragHandle.className = "layout-editor-drag-handle";
	dragHandle.setAttribute("aria-label", "Dra för att flytta sektionen");
	dragHandle.setAttribute("title", "Dra för att flytta sektionen");
	dragHandle.setAttribute("draggable", "true");

	card.append(icon, label, dragHandle);

	return card;
}

// Renderar statusrad i inaktiv-listan, t.ex. laddningstext.
function renderInactiveListState(container, message) {
	const stateRow = document.createElement("li");

	stateRow.className = "grid-item layout-editor-section-card";
	stateRow.setAttribute("draggable", "false");
	stateRow.textContent = String(message || "");

	container.replaceChildren(stateRow);
}

// Hämtar kategorier och renderar dem i inaktiv-listan.
async function populateInactiveSectionList() {
	const inactiveList = document.querySelector("#layout-editor-inactive-list");
	if (!inactiveList) return [];

	renderInactiveListState(inactiveList, "Hämtar kategorier...");

	try {
		const categorySlugs = await fetchSectionCategories();

		if (!Array.isArray(categorySlugs) || categorySlugs.length === 0) {
			renderInactiveListState(inactiveList, "Inga sektioner hittades.");
			return [];
		}

		renderCategoryCards(inactiveList, categorySlugs);
		return categorySlugs;
	} catch (error) {
		console.warn("Category fetch failed:", error);
		renderInactiveListState(inactiveList, "Kunde inte hämta sektioner.");
		return [];
	}
}

function getActiveSectionSlugs() {
	const activeList = document.querySelector("#layout-editor-active-list");
	if (!activeList) return [];

	return Array.from(activeList.querySelectorAll(DND_CARD_SELECTOR))
		.map((card) => normalizeSectionSlug(card.dataset.sectionName))
		.filter(Boolean);
}

function getLayoutEditorFormState() {
	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");

	return {
		storeName: firstNonEmpty(storeNameInput?.value),
		cityName: firstNonEmpty(cityNameInput?.value),
		sections: getActiveSectionSlugs(),
	};
}

function buildFormFingerprint(formState) {
	const normalizedStoreName = firstNonEmpty(formState?.storeName).toLowerCase();
	const normalizedCityName = firstNonEmpty(formState?.cityName).toLowerCase();
	const normalizedSections = Array.isArray(formState?.sections) ? formState.sections.join("|") : "";

	return `${normalizedStoreName}::${normalizedCityName}::${normalizedSections}`;
}

function captureEditModeBaseline(formState) {
	editModeBaselineFingerprint = buildFormFingerprint(formState);
}

function clearEditModeBaseline() {
	editModeBaselineFingerprint = "";
}

function setLayoutEditorMessage(message, tone = "info") {
	const messageElement = document.querySelector("#layout-editor-message");
	if (!messageElement) return;

	messageElement.textContent = String(message || "");
	messageElement.dataset.tone = tone;
}

function setActionButtonsDisabled(isDisabled) {
	const saveButton = document.querySelector("#layout-editor-save-button");
	const cancelButton = document.querySelector("#layout-editor-cancel-button");

	if (saveButton) saveButton.disabled = Boolean(isDisabled);
	if (cancelButton) cancelButton.disabled = Boolean(isDisabled);
}

function setSaveButtonSuccessState(isSuccess) {
	const saveButton = document.querySelector("#layout-editor-save-button");
	if (!saveButton) return;

	saveButton.classList.toggle("layout-editor-save-button-success", Boolean(isSuccess));
}

function clearExistingLayoutCheckTimeout() {
	if (!existingLayoutCheckTimeoutId) return;
	clearTimeout(existingLayoutCheckTimeoutId);
	existingLayoutCheckTimeoutId = null;
}

function getExistingLayoutPromptRoot() {
	return document.querySelector(`#${EXISTING_LAYOUT_PROMPT_ID}`);
}

function ensureExistingLayoutPromptElements() {
	const cityGroup = document.querySelector("#layout-editor-city-name-group");
	if (!cityGroup) return null;

	let promptRoot = getExistingLayoutPromptRoot();
	if (promptRoot) return promptRoot;

	promptRoot = document.createElement("div");
	promptRoot.id = EXISTING_LAYOUT_PROMPT_ID;
	promptRoot.className = "layout-editor-existing-layout-prompt";
	promptRoot.hidden = true;

	const message = document.createElement("p");
	message.id = EXISTING_LAYOUT_PROMPT_MESSAGE_ID;
	message.textContent = "Du har redan skapat en layout för denna butiken, Vill du ändra den?";

	const actions = document.createElement("div");
	actions.className = "layout-editor-existing-layout-actions";

	const yesButton = document.createElement("button");
	yesButton.type = "button";
	yesButton.id = EXISTING_LAYOUT_PROMPT_YES_ID;
	yesButton.className = "btn btn-primary btn-small";
	yesButton.textContent = "Ja";

	const noButton = document.createElement("button");
	noButton.type = "button";
	noButton.id = EXISTING_LAYOUT_PROMPT_NO_ID;
	noButton.className = "btn btn-danger btn-small";
	noButton.textContent = "Nej";

	actions.append(yesButton, noButton);
	promptRoot.append(message, actions);
	cityGroup.appendChild(promptRoot);

	return promptRoot;
}

function showExistingLayoutPrompt() {
	const promptRoot = ensureExistingLayoutPromptElements();
	if (!promptRoot) return;
	promptRoot.hidden = false;
}

function hideExistingLayoutPrompt() {
	const promptRoot = getExistingLayoutPromptRoot();
	if (!promptRoot) return;
	promptRoot.hidden = true;
}

function clearExistingLayoutConflictState() {
	existingLayoutConflict = null;
	hideExistingLayoutPrompt();
}

function syncSaveButtonState() {
	const saveButton = document.querySelector("#layout-editor-save-button");
	if (!saveButton) return;

	const formState = getLayoutEditorFormState();
	const hasNoSections = !Array.isArray(formState.sections) || formState.sections.length === 0;
	const hasExistingLayoutConflict = Boolean(existingLayoutConflict);
	const hasNoEditChanges = Boolean(editModeBaselineFingerprint) && buildFormFingerprint(formState) === editModeBaselineFingerprint;
	saveButton.disabled = saveActionIsPending || hasNoSections || hasExistingLayoutConflict || hasNoEditChanges;

	if (hasExistingLayoutConflict) {
		saveButton.title = "Du har redan en layout för den här butiken och staden. Välj Ja eller Nej under stadfältet.";
		return;
	}

	if (hasNoEditChanges) {
		saveButton.title = "Gör en ändring i butik, stad eller sektionordning för att uppdatera layouten.";
		return;
	}

	saveButton.title = hasNoSections ? "Lägg till minst en sektion i Valda sektioner för att aktivera spara." : "";
}

function bindSaveEligibilitySync() {
	if (!pageLifecycleAbortController) return;

	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");
	const activeList = document.querySelector("#layout-editor-active-list");

	storeNameInput?.addEventListener("input", syncSaveButtonState, { signal: pageLifecycleAbortController.signal });
	cityNameInput?.addEventListener("input", syncSaveButtonState, { signal: pageLifecycleAbortController.signal });

	if (!activeList) return;

	if (activeListMutationObserver) {
		activeListMutationObserver.disconnect();
		activeListMutationObserver = null;
	}

	clearExistingLayoutCheckTimeout();
	existingLayoutConflict = null;
	existingLayoutCheckRequestId = 0;

	activeListMutationObserver = new MutationObserver(() => {
		syncSaveButtonState();
	});

	activeListMutationObserver.observe(activeList, { childList: true });
}

function applySectionOrderToActiveList(sectionSlugs) {
	const activeList = document.querySelector("#layout-editor-active-list");
	const inactiveList = document.querySelector("#layout-editor-inactive-list");
	if (!activeList || !inactiveList) return;

	for (const card of Array.from(activeList.querySelectorAll(DND_CARD_SELECTOR))) {
		inactiveList.appendChild(card);
	}

	applyInitialSectionOrder(sectionSlugs);
}

async function loadExistingLayoutIntoEditor(initialState, conflictState) {
	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");
	const saveButton = document.querySelector("#layout-editor-save-button");
	const heading = document.querySelector("#layout-editor-heading-group h1");

	if (storeNameInput) storeNameInput.value = conflictState.storeName || "";
	if (cityNameInput) cityNameInput.value = conflictState.cityName || "";

	initialState.layoutId = conflictState.layoutId;
	initialState.isEditMode = true;
	if (saveButton) saveButton.textContent = "Uppdatera";
	if (heading) heading.textContent = "Uppdatera butikslayout";

	if (Array.isArray(conflictState.sectionSlugs)) {
		applySectionOrderToActiveList(conflictState.sectionSlugs);
	}

	captureEditModeBaseline({
		storeName: conflictState.storeName,
		cityName: conflictState.cityName,
		sections: Array.isArray(conflictState.sectionSlugs) ? conflictState.sectionSlugs : [],
	});

	clearExistingLayoutConflictState();
	syncSaveButtonState();
	setLayoutEditorMessage("", "info");
}

function handleExistingLayoutPromptNo() {
	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");

	clearExistingLayoutConflictState();

	if (storeNameInput) {
		storeNameInput.value = "";
		storeNameInput.focus();
	}

	if (cityNameInput) {
		cityNameInput.value = "";
	}

	syncSaveButtonState();
	setLayoutEditorMessage("", "info");
}

async function checkExistingLayoutForStoreCity(initialState) {
	if (initialState.isEditMode) {
		clearExistingLayoutConflictState();
		syncSaveButtonState();
		return;
	}

	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");
	const storeName = firstNonEmpty(storeNameInput?.value);
	const cityName = firstNonEmpty(cityNameInput?.value);

	if (!storeName || !cityName) {
		clearExistingLayoutConflictState();
		syncSaveButtonState();
		return;
	}

	const requestId = ++existingLayoutCheckRequestId;

	try {
		const existingLayout = await findMyLayoutByStoreAndCity({ storeName, cityName });
		if (requestId !== existingLayoutCheckRequestId) return;

		if (!existingLayout || existingLayout.layoutId === initialState.layoutId) {
			clearExistingLayoutConflictState();
			syncSaveButtonState();
			return;
		}

		existingLayoutConflict = existingLayout;
		showExistingLayoutPrompt();
		syncSaveButtonState();
	} catch (error) {
		if (requestId !== existingLayoutCheckRequestId) return;
		clearExistingLayoutConflictState();
		syncSaveButtonState();
		setLayoutEditorMessage(error?.message || "Kunde inte kontrollera befintlig butikslayout just nu.", "warning");
	}
}

function scheduleExistingLayoutCheck(initialState) {
	clearExistingLayoutCheckTimeout();
	existingLayoutCheckTimeoutId = setTimeout(() => {
		existingLayoutCheckTimeoutId = null;
		void checkExistingLayoutForStoreCity(initialState);
	}, EXISTING_LAYOUT_CHECK_DEBOUNCE_MS);
}

function bindExistingLayoutConflictControls(initialState) {
	if (!pageLifecycleAbortController) return;

	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");
	const promptRoot = ensureExistingLayoutPromptElements();
	if (!storeNameInput || !cityNameInput || !promptRoot) return;

	const yesButton = promptRoot.querySelector(`#${EXISTING_LAYOUT_PROMPT_YES_ID}`);
	const noButton = promptRoot.querySelector(`#${EXISTING_LAYOUT_PROMPT_NO_ID}`);

	storeNameInput.addEventListener("input", () => {
		clearExistingLayoutConflictState();
		syncSaveButtonState();
		scheduleExistingLayoutCheck(initialState);
	}, { signal: pageLifecycleAbortController.signal });

	cityNameInput.addEventListener("input", () => {
		clearExistingLayoutConflictState();
		syncSaveButtonState();
		scheduleExistingLayoutCheck(initialState);
	}, { signal: pageLifecycleAbortController.signal });

	storeNameInput.addEventListener("blur", () => {
		scheduleExistingLayoutCheck(initialState);
	}, { signal: pageLifecycleAbortController.signal });

	cityNameInput.addEventListener("blur", () => {
		scheduleExistingLayoutCheck(initialState);
	}, { signal: pageLifecycleAbortController.signal });

	yesButton?.addEventListener("click", () => {
		if (!existingLayoutConflict) return;
		void loadExistingLayoutIntoEditor(initialState, existingLayoutConflict);
	}, { signal: pageLifecycleAbortController.signal });

	noButton?.addEventListener("click", () => {
		handleExistingLayoutPromptNo();
	}, { signal: pageLifecycleAbortController.signal });
}

function applyInitialStoreFields(initialState) {
	const storeNameInput = document.querySelector("#layout-editor-store-name");
	const cityNameInput = document.querySelector("#layout-editor-city-name");
	const saveButton = document.querySelector("#layout-editor-save-button");
	const heading = document.querySelector("#layout-editor-heading-group h1");

	if (storeNameInput && initialState.storeName) {
		storeNameInput.value = initialState.storeName;
	}

	if (cityNameInput && initialState.cityName) {
		cityNameInput.value = initialState.cityName;
	}

	if (saveButton && initialState.isEditMode) {
		saveButton.textContent = "Uppdatera";
	}

	if (heading && initialState.isEditMode) {
		heading.textContent = "Uppdatera butikslayout";
	}
}

function applyInitialSectionOrder(sectionSlugs) {
	if (!Array.isArray(sectionSlugs) || sectionSlugs.length === 0) return;

	const activeList = document.querySelector("#layout-editor-active-list");
	const inactiveList = document.querySelector("#layout-editor-inactive-list");
	if (!activeList || !inactiveList) return;

	for (const rawSlug of sectionSlugs) {
		const slug = normalizeSectionSlug(rawSlug);
		if (!slug) continue;

		const selector = `${DND_CARD_SELECTOR}[data-section-name="${slug}"]`;
		const existingCard = document.querySelector(selector);
		const cardToMove = existingCard || createCategoryCardElement(slug);
		if (!cardToMove) continue;

		activeList.appendChild(cardToMove);
	}
}

function validateLayoutEditorSave(formState) {
	if (!formState.storeName) {
		return "Fyll i butiksnamn innan du sparar.";
	}

	if (!formState.cityName) {
		return "Fyll i stad innan du sparar.";
	}

	if (!Array.isArray(formState.sections) || formState.sections.length === 0) {
		return "Lägg till minst en sektion i Valda sektioner innan du sparar.";
	}

	return "";
}

function navigateOnCancel(initialState) {
	const returnPath = normalizeReturnPath(initialState.returnTo);
	if (returnPath) {
		navigateTo(returnPath);
		return;
	}

	if (window.history.length > 1) {
		window.history.back();
		return;
	}

	navigateTo(DEFAULT_CANCEL_PATH);
}

async function handleSaveButtonClick(initialState) {
	const formState = getLayoutEditorFormState();
	const validationError = validateLayoutEditorSave(formState);

	if (validationError) {
		setLayoutEditorMessage(validationError, "error");
		syncSaveButtonState();
		return;
	}

	saveActionIsPending = true;
	setSaveButtonSuccessState(false);
	syncSaveButtonState();
	setActionButtonsDisabled(true);
	setLayoutEditorMessage(initialState.isEditMode ? "Uppdaterar butikslayout..." : "Sparar butikslayout...", "info");

	try {
		const result = await saveStoreLayout({
			layoutId: initialState.layoutId || "",
			storeName: formState.storeName,
			cityName: formState.cityName,
			sectionSlugs: formState.sections,
		});

		initialState.layoutId = result.layoutId;
		initialState.isEditMode = true;
		captureEditModeBaseline(formState);
		setSaveButtonSuccessState(true);
		setLayoutEditorMessage(result.mode === "created" ? "Butikslayout sparad." : "Butikslayout uppdaterad.", "success");

		window.setTimeout(() => {
			navigateOnCancel(initialState);
		}, SAVE_SUCCESS_REDIRECT_DELAY_MS);
	} catch (error) {
		setSaveButtonSuccessState(false);
		setLayoutEditorMessage(error?.message || "Kunde inte spara butikslayouten.", "error");
	} finally {
		saveActionIsPending = false;
		setActionButtonsDisabled(false);
		syncSaveButtonState();
	}
}

function bindLayoutEditorActions(initialState) {
	if (!pageLifecycleAbortController) return;

	const saveButton = document.querySelector("#layout-editor-save-button");
	const cancelButton = document.querySelector("#layout-editor-cancel-button");
	if (!saveButton || !cancelButton) return;

	saveButton.addEventListener("click", () => {
		void handleSaveButtonClick(initialState);
	}, { signal: pageLifecycleAbortController.signal });

	cancelButton.addEventListener("click", () => {
		navigateOnCancel(initialState);
	}, { signal: pageLifecycleAbortController.signal });
}

async function initializeLayoutEditorData(initialState) {
	applyInitialStoreFields(initialState);
	await populateInactiveSectionList();
	applyInitialSectionOrder(initialState.sections);

	if (initialState.isEditMode) {
		captureEditModeBaseline(getLayoutEditorFormState());
	} else {
		clearEditModeBaseline();
	}

	syncSaveButtonState();
}

// Returnerar true om layout-editor-sidan finns monterad i DOM.
function isLayoutEditorPageMounted() {
	return Boolean(document.querySelector("#layout-editor-page"));
}

// Städar upp listeners och tillfällig drag-state när sidan avmonteras.
function teardownLayoutEditorPage() {
	if (pageLifecycleAbortController) {
		pageLifecycleAbortController.abort();
		pageLifecycleAbortController = null;
	}

	if (activeListMutationObserver) {
		activeListMutationObserver.disconnect();
		activeListMutationObserver = null;
	}

	stopTouchAutoScroll();
	clearDropMarker();
	clearPendingDropTarget();
	setTouchDragScrollLock(false);

	if (mouseDraggedCard) {
		mouseDraggedCard.classList.remove("is-dragging");
	}

	if (touchDraggedCard) {
		touchDraggedCard.classList.remove("is-dragging");
	}

	mouseDraggedCard = null;
	touchDraggedCard = null;
	touchClientX = 0;
	touchClientY = 0;
	saveActionIsPending = false;
	clearEditModeBaseline();
}

// Initierar hela layout-editorns interaktion och datahämtning.
export function setupLayoutEditorPage() {
	teardownLayoutEditorPage();

	if (!isLayoutEditorPageMounted()) {
		return;
	}

	pageLifecycleAbortController = new AbortController();
	const initialState = parseLayoutEditorInitialState();

	syncInstructionsByViewport();
	bindInstructionsViewportSync();
	setupDragAndDrop();
	setupTouchDragAndDrop();
	bindSaveEligibilitySync();
	bindExistingLayoutConflictControls(initialState);
	bindLayoutEditorActions(initialState);
	void initializeLayoutEditorData(initialState);
}

// Synkar instruktionspanelen med viewport så desktop alltid visar innehållet.
function syncInstructionsByViewport() {
	const instructions = document.querySelector("#layout-editor-instructions");
	if (!instructions) return;

	if (window.innerWidth >= DESKTOP_LAYOUT_MIN_WIDTH) {
		instructions.setAttribute("open", "");
		return;
	}

	instructions.removeAttribute("open");
}

// Binder resize-lyssnare en gång för att hålla instruktionspanelens state korrekt.
function bindInstructionsViewportSync() {
	if (!pageLifecycleAbortController) return;

	window.addEventListener("resize", syncInstructionsByViewport, { signal: pageLifecycleAbortController.signal });
}
