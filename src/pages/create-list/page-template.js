export function renderCreateListPageTemplate() {
	return `
		<section class="create-list create-list-page" aria-label="Skapa inköpslista - välj butik">
			<header class="create-list__nav create-list-header" role="banner">
				<button type="button" id="create-list-back-button" class="create-list__back-button" aria-label="Gå tillbaka">
					<i class="ti ti-chevron-left" aria-hidden="true"></i>
				</button>
				<h1 class="create-list__title">Välj butik</h1>
				<span class="create-list__header-spacer" aria-hidden="true"></span>
			</header>

			<div class="create-list__content page-container--narrow">

				<div class="create-list__search create-list__search-card card create-list-section">
				<div class="create-list__field-group">
					<label class="create-list__label" for="city-input">Stad</label>
					<input
						class="input-field"
						id="city-input"
						type="text"
						placeholder="Exempel: Stadsnamn"
						autocomplete="off"
					/>
				</div>

				<div class="create-list__field-group">
					<label class="create-list__label" for="store-name-input">Butiksnamn</label>
					<input
						class="input-field"
						id="store-name-input"
						type="text"
						placeholder="Exempel: Butiksnamn"
						autocomplete="off"
					/>
				</div>

				<button type="button" id="find-or-create-store-button" class="btn btn-primary create-list__button" hidden>Skapa butik</button>

				<div class="create-list__dropdown" id="store-search-results" aria-live="polite" hidden></div>
			</div>

				<div id="layout-list-wrapper" class="create-list__layouts create-list-section" hidden>
				<h2 class="create-list__section-title">Tillgängliga layouter</h2>
				<p id="selected-store-name" class="create-list__selected-store"></p>
				<div id="layout-list" class="create-list__layout-list layout-list"></div>
				<p id="selected-layout-summary" class="create-list__selected-layout" aria-live="polite"></p>
				</div>
			</div>
		</section>
	`;
}
