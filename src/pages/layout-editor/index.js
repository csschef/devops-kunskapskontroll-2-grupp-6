import { setupLayoutEditorPage } from "./layout-editor-controller.js";
import "./layout-editor.css";
import aisleLogo from "../../assets/aisle-logo.svg";

const layoutEditorRouteImageUrl = new URL("../../assets/images/point-a-to-b.png", import.meta.url).href;

export function renderLayoutEditorPage() {
	document.title = "AISLE - Skapa butikslayout";
	setTimeout(setupLayoutEditorPage, 0);

	return `
		<section class="layout-editor-shell">
			<div class="layout-editor-fixed-bg" aria-hidden="true"></div>
			<section class="page-container" id="layout-editor-page">
				<div id="layout-editor-grid">

					<div class="layout-editor-topbar">
						<a href="/" class="layout-editor-logo-link" aria-label="Till startsidan">
							<span class="layout-editor-logo" style="--auth-logo-src: url('${aisleLogo}')" aria-hidden="true"></span>
						</a>
						<div class="layout-editor-topbar-actions">
							<a class="btn btn-secondary" href="/profile" id="layout-editor-back-button">
								<i class="ti ti-arrow-left" aria-hidden="true"></i>
								<span>Tillbaka</span>
							</a>
						</div>
					</div>

					<header id="layout-editor-brand-panel">
						<div id="layout-editor-heading-group">
							<h1>Skapa <span class="layout-editor-hero-accent">din</span> butikslayout</h1>
						</div>
						<p id="layout-editor-hero-sub">Lägg till gångordningen för din butik genom att dra sektioner i rätt ordning.</p>

						<div id="layout-editor-instructions">
							<ul id="layout-editor-instructions-list" class="layout-editor-feature-list">
								<li>Fyll i butiksnamn och stad.</li>
								<li>Dra sektioner från inaktiv lista till aktiv lista.</li>
								<li>Sortera sektionerna i aktiv lista i samma ordning som de kommer i butiken.</li>
								<li>Klicka på spara.</li>
							</ul>
						</div>

						<img
							id="layout-editor-route-image"
							src="${layoutEditorRouteImageUrl}"
							alt="Visualisering av butiksrutt"
							aria-hidden="true"
						/>
					</header>

					<section class="card" id="layout-editor-builder-card">
						<section id="layout-editor-store-meta">
							<h4>Butiksinformation</h4>
							<div class="form-group" id="layout-editor-store-name-group">
								<label for="layout-editor-store-name">Butiksnamn</label>
								<input type="text" class="input-field" id="layout-editor-store-name" name="storeName" placeholder="Ex: ICA Maxi" required />
							</div>

							<div class="form-group" id="layout-editor-city-name-group">
								<label for="layout-editor-city-name">Stad</label>
								<input type="text" class="input-field" id="layout-editor-city-name" name="cityName" placeholder="Ex: Stockholm" required />
							</div>
						</section>

						<section class="section-block" id="layout-editor-lists">
							<section id="layout-editor-active-wrapper">
								<h4>Valda sektioner</h4>
								<ul id="layout-editor-active-list" aria-label="Aktiv butikslayout"></ul>
							</section>
						</section>

						<footer id="layout-editor-actions">
							<button type="button" class="btn btn-primary" id="layout-editor-save-button">Spara</button>
							<button type="button" class="btn btn-secondary" id="layout-editor-cancel-button">Avbryt</button>
							<p id="layout-editor-message" aria-live="polite"></p>
						</footer>
					</section>

					<section class="card" id="layout-editor-inactive-card">
						<h4>Tillgängliga sektioner</h4>
						<ul id="layout-editor-inactive-list" aria-label="Tillgängliga sektioner">
							<li class="grid-item layout-editor-section-card" draggable="false">Hämtar kategorier...</li>
						</ul>
					</section>

				</div>
			</section>
		</section>
	`;
}
