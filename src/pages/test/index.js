// Test environment for CSS styling
// Grid, form, button, and other elements to test global CSS

export function renderCreateStoreLayoutPage() {
	return `
		<div class="page-container">
			<h1>Store Layout Editor</h1>
			
			<!-- Grid Showcase -->
			<section class="section-block">
				<h2>Grid Layout Test</h2>
				<div class="content-grid">
					<div class="grid-item">Item 1</div>
					<div class="grid-item">Item 2</div>
					<div class="grid-item">Item 3</div>
					<div class="grid-item">Item 4</div>
				</div>
			</section>

			<!-- Form Showcase -->
			<section class="section-block">
				<h2>Form Elements Test</h2>
				<form class="form-surface">
					<div class="form-group">
						<label for="store-name">Store Name</label>
						<input 
							type="text" 
							id="store-name" 
							placeholder="Enter store name"
							class="input-field"
						/>
					</div>

					<div class="form-group">
						<label for="store-category">Category</label>
						<select id="store-category" class="select-field">
							<option value="">Select a category</option>
							<option value="electronics">Electronics</option>
							<option value="clothing">Clothing</option>
							<option value="food">Food</option>
						</select>
					</div>

					<div class="form-group">
						<label for="description">Description</label>
						<textarea 
							id="description"
							placeholder="Describe your store"
							class="textarea-field"
							rows="4"
						></textarea>
					</div>

					<div class="form-group checkbox-group">
						<label>
							<input type="checkbox" class="checkbox-field" />
							<span>Enable notifications</span>
						</label>
					</div>
				</form>
			</section>

			<!-- Button Showcase -->
			<section class="section-block">
				<h2>Button Variants</h2>
				<div class="button-group">
					<button class="btn btn-primary">Primary Button</button>
					<button class="btn btn-secondary">Secondary Button</button>
					<button class="btn btn-danger">Delete</button>
					<button class="btn btn-primary" disabled>Disabled</button>
				</div>
			</section>

			<!-- Card Showcase -->
			<section class="section-block">
				<h2>Card Component</h2>
				<div class="card">
					<h3>Card Title</h3>
					<p>This is a sample card to test styling and spacing.</p>
					<button class="btn btn-primary btn-small">Learn More</button>
				</div>
			</section>

			<!-- Status States -->
			<section class="section-block">
				<h2>Status States</h2>
				<div class="status-group">
					<div class="status-badge status-success">Success</div>
					<div class="status-badge status-warning">Warning</div>
					<div class="status-badge status-error">Error</div>
					<div class="status-badge status-info">Info</div>
				</div>
			</section>
		</div>
	`;
}
