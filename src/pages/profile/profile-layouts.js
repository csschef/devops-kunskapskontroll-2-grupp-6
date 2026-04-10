import { navigateTo } from "../../router/router.js";
import { getUserLayouts } from "./profile-service.js";
 
function buildEditLayoutUrl(layout) {
	const params = new URLSearchParams({
		storeName: layout.stores?.name ?? "",
		city: layout.stores?.city ?? "",
	});
	return `/layout-editor?${params.toString()}`;
}
 
export function renderLayoutCard(layout) {
	const storeName = layout.stores?.name ?? "Okänd butik";
	const city = layout.stores?.city ?? "";
 
	return `
		<div class="layout-card">
			<div>
				<p><strong>${storeName} – ${city}</strong></p>
				<p>${layout.name}</p>
			</div>
			<button class="btn btn-primary" data-edit-layout-id="${layout.id}" type="button">
				Redigera
			</button>
		</div>
	`;
}
 
function setupEditButtons(layouts) {
	const container = document.querySelector("#profile-layouts-container");
	if (!container) return;
 
	container.addEventListener("click", (event) => {
		const button = event.target.closest("[data-edit-layout-id]");
		if (!button) return;
 
		const layoutId = button.dataset.editLayoutId;
		const layout = layouts.find((l) => l.id === layoutId);
		if (!layout) return;
 
		navigateTo(buildEditLayoutUrl(layout));
	});
}
 
export function setupProfileLayouts() {
	const container = document.querySelector("#profile-layouts-container");
	if (!container) return;
 
	void (async () => {
		try {
			const layouts = await getUserLayouts();
 
			if (!layouts || layouts.length === 0) {
				container.innerHTML = `<p>Du har inga sparade butikslayouter än.</p>`;
				return;
			}
 
			container.innerHTML = layouts.map(renderLayoutCard).join("");
			setupEditButtons(layouts);
		} catch (error) {
			container.innerHTML = `<p>${error?.message || "Kunde inte hämta layouter."}</p>`;
		}
	})();
}