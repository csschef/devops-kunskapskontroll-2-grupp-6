import { supabase } from "../../api-service.js";

function setStatus(message, isError = false) {
  const statusEl = document.getElementById("product-debug-status");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("text-danger", Boolean(isError));
}

function clearRows() {
  const rowsEl = document.getElementById("product-debug-rows");
  const emptyEl = document.getElementById("product-debug-empty");
  if (!rowsEl || !emptyEl) return;

  rowsEl.replaceChildren();
  emptyEl.hidden = true;
}

function addRow({ id, productName, categoryName }) {
  const rowsEl = document.getElementById("product-debug-rows");
  if (!rowsEl) return;

  const tr = document.createElement("tr");

  const idTd = document.createElement("td");
  idTd.textContent = id == null ? "" : String(id);

  const productTd = document.createElement("td");
  productTd.textContent = productName || "";

  const categoryTd = document.createElement("td");
  categoryTd.textContent = categoryName || "(no category)";

  tr.append(idTd, productTd, categoryTd);
  rowsEl.appendChild(tr);
}

async function fetchProductsViaCategoryId() {
  const productsRes = await supabase
    .from("products")
    .select("id, name, category_id")
    .order("name", { ascending: true })
    .limit(2000);

  if (productsRes.error) throw productsRes.error;

  const categoriesRes = await supabase
    .from("categories")
    .select("id, name")
    .limit(2000);

  if (categoriesRes.error) throw categoriesRes.error;

  const categoryById = new Map((categoriesRes.data || []).map((cat) => [String(cat.id), cat.name]));

  return (productsRes.data || []).map((row) => ({
    id: row.id,
    productName: row.name,
    categoryName: categoryById.get(String(row.category_id)) || "",
  }));
}

async function fetchProductsViaJoin() {
  const res = await supabase
    .from("products")
    .select("id, name, categories(name)")
    .order("name", { ascending: true })
    .limit(2000);

  if (res.error) throw res.error;

  return (res.data || []).map((row) => ({
    id: row.id,
    productName: row.name,
    categoryName: row.categories?.name || "",
  }));
}

async function loadProducts() {
  clearRows();

  if (!supabase) {
    setStatus("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.", true);
    return;
  }

  const attempts = [
    { label: "products + category_id", fn: fetchProductsViaCategoryId },
    { label: "products join categories", fn: fetchProductsViaJoin },
  ];

  const errors = [];

  for (const attempt of attempts) {
    try {
      setStatus(`Loading (${attempt.label})...`);
      const rows = await attempt.fn();

      for (const row of rows) {
        addRow(row);
      }

      const emptyEl = document.getElementById("product-debug-empty");
      if (emptyEl && rows.length === 0) {
        emptyEl.hidden = false;
      }

      setStatus(`Loaded ${rows.length} rows using: ${attempt.label}`);
      return;
    } catch (error) {
      const msg = error?.message || String(error);
      errors.push(`${attempt.label}: ${msg}`);
    }
  }

  setStatus(`Could not load data. Tried: ${errors.join(" | ")}`, true);
}

export function setupProductListDebugPage() {
  const reloadButton = document.getElementById("product-debug-reload");
  if (reloadButton) {
    reloadButton.addEventListener("click", () => {
      void loadProducts();
    });
  }

  void loadProducts();
}

export function renderProductListDebugPage() {
  document.title = "AISLE - Product list debug";

  return `
    <section class="page-container">
      <h1>Product list debug</h1>
      <p>Temporary debug view for products and category names.</p>

      <div class="card" style="padding: 16px; margin-top: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <h3 style="margin: 0;">Products with category name</h3>
          <button id="product-debug-reload" type="button" class="btn btn-primary">Reload</button>
        </div>

        <p id="product-debug-status" style="margin-top: 12px; color: #6b7280;">Loading...</p>

        <div style="overflow: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px;">ID</th>
                <th style="text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px;">Product</th>
                <th style="text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px;">Category</th>
              </tr>
            </thead>
            <tbody id="product-debug-rows"></tbody>
          </table>
        </div>

        <p id="product-debug-empty" hidden style="margin-top: 12px; color: #6b7280;">No rows found.</p>
      </div>
    </section>
  `;
}
