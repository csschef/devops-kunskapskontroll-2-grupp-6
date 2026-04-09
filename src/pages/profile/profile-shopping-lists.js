import { getUserShoppingLists } from "./profile-service.js";
import { supabase } from "../../api-service.js";
 
export function renderShoppingListCard(list) {
	const items = list.shopping_list_items ?? [];
	const itemCount = items.length;
	const checkedCount = items.filter((item) => item.is_checked).length;
	const statusText = list.is_completed ? "Slutförd" : "Aktiv";
	const statusClass = list.is_completed ? "status--completed" : "status--active";
 
	return `
		<div class="shopping-list-card" data-list-id="${list.id}">
			<div class="shopping-list-card__info">
				<p class="shopping-list-card__title"><strong>${list.title}</strong></p>
				<p class="${statusClass}">${statusText}</p>
				<p>
					${itemCount} ${itemCount === 1 ? "vara" : "varor"}
					${itemCount > 0 ? `· ${checkedCount} av ${itemCount} klara` : ""}
				</p>
			</div>
			<div style="display: flex; gap: 8px;">
				<button class="btn btn-secondary" data-view-list-id="${list.id}" type="button">
					Visa
				</button>
				<button class="btn btn-primary" data-edit-list-id="${list.id}" type="button">
					Redigera
				</button>
			</div>
		</div>
	`;
}
 
function renderEditForm(list) {
	return `
		<div class="shopping-list-card" data-list-id="${list.id}">
			<div class="shopping-list-card__info">
				<input
					class="shopping-list-edit-input"
					type="text"
					value="${list.title}"
					data-original-title="${list.title}"
				/>
				<p id="edit-list-message-${list.id}" style="margin-top: 8px;"></p>
			</div>
			<div style="display: flex; flex-direction: column; gap: 8px;">
				<button class="btn btn-primary" data-save-list-id="${list.id}" type="button">
					Spara
				</button>
				<button class="btn btn-secondary" data-cancel-list-id="${list.id}" type="button">
					Avbryt
				</button>
			</div>
		</div>
	`;
}
 
function setupListButtons(lists) {
	const container = document.querySelector("#profile-shopping-lists-container");
	if (!container) return;
 
	container.addEventListener("click", async (event) => {
 
		// Redigera-knapp — byt ut kortet mot formulär
		const editButton = event.target.closest("[data-edit-list-id]");
		if (editButton) {
			const listId = editButton.dataset.editListId;
			const list = lists.find((l) => l.id === listId);
			if (!list) return;
 
			const card = container.querySelector(`[data-list-id="${listId}"]`);
			if (card) card.outerHTML = renderEditForm(list);
			return;
		}
        
        // Visa-knapp — Redirect till listan
		const viewButton = event.target.closest("[data-view-list-id]");
		if (viewButton) {
			const listId = viewButton.dataset.viewListId;
			// Här gör vi redirect till den nya URL:en
			window.location.href = `/list/${listId}`;
			return;
		}
 
		// Avbryt-knapp — återställ kortet
		const cancelButton = event.target.closest("[data-cancel-list-id]");
		if (cancelButton) {
			const listId = cancelButton.dataset.cancelListId;
			const list = lists.find((l) => l.id === listId);
			if (!list) return;
 
			const card = container.querySelector(`[data-list-id="${listId}"]`);
			if (card) card.outerHTML = renderShoppingListCard(list);
			return;
		}
 
		// Spara-knapp — uppdatera titeln i databasen
		const saveButton = event.target.closest("[data-save-list-id]");
		if (saveButton) {
			const listId = saveButton.dataset.saveListId;
			const card = container.querySelector(`[data-list-id="${listId}"]`);
			const input = card?.querySelector(".shopping-list-edit-input");
			const message = card?.querySelector(`#edit-list-message-${listId}`);
			if (!input) return;
 
			const newTitle = input.value.trim();
			if (!newTitle) {
				if (message) message.textContent = "Namnet får inte vara tomt.";
				return;
			}
 
			saveButton.disabled = true;
			if (message) message.textContent = "Sparar...";
 
			try {
				const { error } = await supabase
					.from("shopping_lists")
					.update({ title: newTitle })
					.eq("id", listId);
 
				if (error) throw error;
 
				// Uppdatera listan lokalt och återställ kortet med nytt namn
				const list = lists.find((l) => l.id === listId);
				if (list) list.title = newTitle;
				if (card) card.outerHTML = renderShoppingListCard(lists.find((l) => l.id === listId));
			} catch (error) {
				if (message) message.textContent = error?.message || "Kunde inte spara.";
				saveButton.disabled = false;
			}
		}
	});
}
 
export function setupProfileShoppingLists() {
	const container = document.querySelector("#profile-shopping-lists-container");
	if (!container) return;
 
	void (async () => {
		try {
			const lists = await getUserShoppingLists();
 
			if (!lists || lists.length === 0) {
				container.innerHTML = `<p>Du har inga sparade inköpslistor än.</p>`;
				return;
			}
 
			container.innerHTML = lists.map(renderShoppingListCard).join("");
			setupListButtons(lists);
		} catch (error) {
			container.innerHTML = `<p>${error?.message || "Kunde inte hämta inköpslistor."}</p>`;
		}
	})();
}