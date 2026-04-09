export function renderShoppingListPageTemplate() {
	return `
		<section class="list-page" aria-label="Min Inköpslista">
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
				<button
					type="button"
					id="list-share-button"
					class="list-page__share-button"
					aria-label="Hantera delning"
					aria-pressed="false"
				>
					<i class="ti ti-users" aria-hidden="true"></i>
				</button>
			</header>

			<div class="list-page__content page-container--narrow">
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
				<label for="list-product-search" class="sr-only">Lägg till vara</label>
				<input
					id="list-product-search"
					class="input-field list-page__search-input"
					type="search"
					placeholder="Sök eller lägg till vara..."
					aria-label="Lägg till vara"
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
			<section id="list-share-management" class="list-page__share-view" hidden aria-label="Hantera delning"></section>
			</div>
		</section>
	`;
}
