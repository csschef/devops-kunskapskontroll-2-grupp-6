import { setupLayoutEditorPage } from "./layout-editor-controller.js";
import "../../css/layout-editor.css";

export function renderLayoutEditorPage() {
	document.title = "AISLE - Skapa butikslayout";
	setTimeout(setupLayoutEditorPage, 0);

	return `
		<section class="page-container" id="layout-editor-page">
			<header class="section-block card" id="layout-editor-header" style="padding: var(--spacing-lg);">
				<section id="layout-editor-brand-panel">
					<div id="layout-editor-heading-group" style="display: grid; gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
						<p style="letter-spacing: .08em; font-size: var(--font-size-sm); text-transform: uppercase; color: var(--color-primary-700); font-weight: var(--font-weight-semibold); margin: 0;">AISLE</p>
						<h1 style="margin: 0;">Skapa din butikslayout</h1>
					</div>
					<p>Lägg till gångordningen för din butik genom att dra sektioner i rätt ordning.</p>

					<details id="layout-editor-instructions">
						<summary id="layout-editor-instructions-toggle">Instruktioner</summary>
						<div id="layout-editor-instructions-body">
							<ul id="layout-editor-instructions-list">
								<li>Fyll i butiksnamn och stad.</li>
								<li>Dra sektioner från inaktiv lista till aktiv lista.</li>
								<li>Sortera sektionerna i aktiv lista i samma ordning som de kommer i butiken.</li>
								<li>Klicka på spara butikslayout.</li>
							</ul>
						</div>
					</details>

					<img
						id="layout-editor-route-image"
						src="/src/assets/images/point-a-to-b.png"
						alt="Visualisering av butiksrutt"
					/>
				</section>

				<hr style="border: 0; border-top: 1px solid var(--color-border); margin: var(--spacing-lg) calc(-1 * var(--spacing-lg)); width: calc(100% + (2 * var(--spacing-lg)));" />

				<section class="card" id="layout-editor-builder-card" style="padding: var(--spacing-lg);">
				<section id="layout-editor-store-meta">
					<div class="form-group" id="layout-editor-store-name-group">
						<label for="layout-editor-store-name">Butiksnamn</label>
						<input type="text" class="input-field" id="layout-editor-store-name" name="storeName" placeholder="Ex: ICA Maxi" required />
					</div>

					<div class="form-group" id="layout-editor-city-name-group">
						<label for="layout-editor-city-name">Stad</label>
						<input type="text" class="input-field" id="layout-editor-city-name" name="cityName" placeholder="Ex: Stockholm" required />
					</div>
				</section>

				<section class="section-block" id="layout-editor-lists" style="padding: 0;">
					<section id="layout-editor-active-wrapper">
						<h2 style="font-size: var(--font-size-xl);">Aktiva avdelningar</h2>
						<ul id="layout-editor-active-list" aria-label="Aktiv butikslayout"></ul>
					</section>

					<section id="layout-editor-inactive-wrapper">
						<h2 style="font-size: var(--font-size-xl);">Inaktiva avdelningar</h2>
						<ul id="layout-editor-inactive-list" aria-label="Tillgängliga sektioner">
							<li class="grid-item layout-editor-section-card" draggable="false">Hämtar kategorier...</li>
						</ul>
					</section>
				</section>

				<footer id="layout-editor-actions" style="text-align: center;">
					<button type="button" class="btn btn-primary" id="layout-editor-save-button" style="width: 100%; max-width: none;">Spara butikslayout</button>
					<button type="button" class="btn btn-danger" id="layout-editor-cancel-button" style="width: 100%; max-width: none; margin-top: 12px;">Avbryt</button>
					<p id="layout-editor-message" aria-live="polite"></p>
				</footer>
				</section>
			</header>
		</section>
	`;
}
