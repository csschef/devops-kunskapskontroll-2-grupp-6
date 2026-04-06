import { fetchSectionCategories } from "./layout-service.js";

const DND_CARD_SELECTOR = ".layout-editor-section-card";
const TOUCH_AUTO_SCROLL_EDGE_PX = 88;
const TOUCH_AUTO_SCROLL_MAX_STEP = 18;
let touchDraggedCard = null;
let mouseDraggedCard = null;
let currentDropMarkerElement = null;
let pendingDropTargetList = null;
let pendingDropTargetCard = null;
let touchClientX = 0;
let touchClientY = 0;
let touchAutoScrollFrameId = null;
const DEV_FALLBACK_CATEGORIES = ["Frukt och Grönt", "Kött och Fågel", "Mejeri", "Bröd", "Frys"];
const DESKTOP_LAYOUT_MIN_WIDTH = 900;

// Normaliserar kategorinamnet så jämförelser blir stabila.
function normalizeCategoryKey(name) {
	return String(name || "")
		.toLowerCase()
		.trim();
}

// Returnerar passande ikonklass baserat på kategorinamn.
function getCategoryIconClass(name) {
	const key = normalizeCategoryKey(name);

	if (key.includes("frukt") || key.includes("grön") || key.includes("gronsak")) return "ti ti-apple";
	if (key.includes("kött") || key.includes("fågel") || key.includes("kyckling")) return "ti ti-meat";
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
	container.innerHTML = categories.map((category) => renderCategoryCard(category)).join("");
}

// Kontrollerar att elementet är ett dragbart kategorikort.
function isDraggableCard(card) {
	return Boolean(card && card.matches(DND_CARD_SELECTOR) && card.getAttribute("draggable") === "true");
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

// Flyttar kort inom samma lista till rätt position.
function moveCardInList(list, draggedCard, pointerY) {
	if (!list || !draggedCard) return;

	const targetCard = getDropTargetCard(list, pointerY, draggedCard);

	if (!targetCard) {
		list.appendChild(draggedCard);
		return;
	}

	list.insertBefore(draggedCard, targetCard);
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

	list.insertBefore(draggedCard, targetCard);
}

// Hämtar kortet som ursprungligen låg efter det dragna kortet.
function getInitialTargetCardFromSource(draggedCard) {
	if (!draggedCard) return null;

	const nextSibling = draggedCard.nextElementSibling;
	if (nextSibling && nextSibling.matches(DND_CARD_SELECTOR)) {
		return nextSibling;
	}

	return null;
}

// Returnerar true om drop inte skulle ändra något.
function isNoOpDropTarget(list, targetCard, draggedCard) {
	if (!list || !isDraggableCard(draggedCard)) return true;

	if (isInactiveList(list)) {
		return draggedCard.parentElement === list;
	}

	if (draggedCard.parentElement !== list) {
		return false;
	}

	const initialTargetCard = getInitialTargetCardFromSource(draggedCard);
	if (targetCard) {
		return targetCard === initialTargetCard;
	}

	return !initialTargetCard;
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
	const targetCard = isInactiveList(list) ? null : getDropTargetCard(list, event.clientY, draggedCard);
	updateDropTargetState(list, targetCard, draggedCard);
	commitPendingDrop(draggedCard);
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

// Beräknar autoscroll-hastighet nära viewportens kanter.
function getTouchAutoScrollDelta(pointerY) {
	if (pointerY < TOUCH_AUTO_SCROLL_EDGE_PX) {
		const intensity = (TOUCH_AUTO_SCROLL_EDGE_PX - pointerY) / TOUCH_AUTO_SCROLL_EDGE_PX;
		return -Math.ceil(intensity * TOUCH_AUTO_SCROLL_MAX_STEP);
	}

	const bottomEdgeStart = window.innerHeight - TOUCH_AUTO_SCROLL_EDGE_PX;
	if (pointerY > bottomEdgeStart) {
		const intensity = (pointerY - bottomEdgeStart) / TOUCH_AUTO_SCROLL_EDGE_PX;
		return Math.ceil(intensity * TOUCH_AUTO_SCROLL_MAX_STEP);
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
	if (!touchAutoScrollFrameId) return;
	cancelAnimationFrame(touchAutoScrollFrameId);
	touchAutoScrollFrameId = null;
}
 
// Kör auto-scroll-loop under touch-drag.
function runTouchAutoScrollLoop() {
	if (!isDraggableCard(touchDraggedCard)) {
		stopTouchAutoScroll();
		return;
	}

	const delta = getTouchAutoScrollDelta(touchClientY);
	if (delta !== 0) {
		window.scrollBy(0, delta);
		updateTouchDropTarget(touchClientX, touchClientY);
	}

	touchAutoScrollFrameId = requestAnimationFrame(runTouchAutoScrollLoop);
}

// Startar auto-scroll-loop om den inte redan kör.
function startTouchAutoScroll() {
	if (touchAutoScrollFrameId) return;
	touchAutoScrollFrameId = requestAnimationFrame(runTouchAutoScrollLoop);
}

// Initierar touch-drag när användaren börjar dra ett kort.
function handleListTouchStart(event) {
	const card = event.target.closest(DND_CARD_SELECTOR);
	if (!isDraggableCard(card)) return;
	event.preventDefault();
	const touch = event.touches?.[0];
	if (touch) {
		touchClientX = touch.clientX;
		touchClientY = touch.clientY;
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
	updateTouchDropTarget(touchClientX, touchClientY);
	startTouchAutoScroll();
}

// Avslutar touch-drag och återställer temporär state.
function endTouchDragging() {
	if (!touchDraggedCard) return;
	commitPendingDrop(touchDraggedCard);
	touchDraggedCard.classList.remove("is-dragging");
	touchDraggedCard = null;
	touchClientX = 0;
	touchClientY = 0;
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

	if (document.body.dataset.layoutTouchDndBound === "true") return;
	document.body.dataset.layoutTouchDndBound = "true";

	document.addEventListener("touchmove", handleDocumentTouchMove, { passive: false });
	document.addEventListener("touchend", endTouchDragging);
	document.addEventListener("touchcancel", endTouchDragging);
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

// Returnerar HTML för ett enskilt kategorikort.
function renderCategoryCard(name) {
	const safeName = String(name || "").trim();
	if (!safeName) return "";
	const iconClass = getCategoryIconClass(safeName);

	return `<li class="grid-item layout-editor-section-card" data-section-name="${safeName}" draggable="true"><i class="${iconClass} layout-editor-category-icon" aria-hidden="true"></i><span class="layout-editor-category-name">${safeName}</span></li>`;
}

// Renderar statusrad i inaktiv-listan, t.ex. laddningstext.
function renderInactiveListState(container, message) {
	container.innerHTML = `<li class="grid-item layout-editor-section-card" draggable="false">${message}</li>`;
}

// Hämtar kategorier och renderar dem i inaktiv-listan.
async function populateInactiveSectionList() {
	const inactiveList = document.querySelector("#layout-editor-inactive-list");
	if (!inactiveList) return;

	renderInactiveListState(inactiveList, "Hämtar kategorier...");

	try {
		const categories = await fetchSectionCategories();

		if (!Array.isArray(categories) || categories.length === 0) {
			renderCategoryCards(inactiveList, DEV_FALLBACK_CATEGORIES);
			return;
		}

		renderCategoryCards(inactiveList, categories);
	} catch (error) {
		console.warn("Category fetch failed, using fallback categories:", error);
		renderCategoryCards(inactiveList, DEV_FALLBACK_CATEGORIES);
	}
}

// Initierar hela layout-editorns interaktion och datahämtning.
export function setupLayoutEditorPage() {
	syncInstructionsByViewport();
	bindInstructionsViewportSync();
	setupDragAndDrop();
	setupTouchDragAndDrop();
	void populateInactiveSectionList();
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
	if (document.body.dataset.layoutInstructionsViewportBound === "true") return;
	document.body.dataset.layoutInstructionsViewportBound = "true";

	window.addEventListener("resize", syncInstructionsByViewport);
}
