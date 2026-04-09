import { resolveRoute } from "./routes.js";
import { getCurrentSession } from "../auth-service.js";

function applyLayoutEditorPrefillFromQuery(pathname) {
  if (!/^\/layout-editor($|\/)/.test(pathname)) {
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const storeName = searchParams.get("storeName") ?? "";
  const city = searchParams.get("city") ?? "";

  const storeNameInput = document.querySelector("#layout-editor-store-name");
  const cityInput = document.querySelector("#layout-editor-city-name");

  if (storeNameInput instanceof HTMLInputElement && storeName) {
    storeNameInput.value = storeName;
  }

  if (cityInput instanceof HTMLInputElement && city) {
    cityInput.value = city;
  }
}

async function renderCurrentRoute() {
  const app = document.querySelector("#app");
  if (!app) return;

  const currentPath = window.location.pathname;
  const route = resolveRoute(currentPath);
  const session = await getCurrentSession();
  const isAuthenticated = Boolean(session?.user);
  const isAuthPage = /^\/(login|register)\/?$/.test(currentPath);

  if (route.requiresAuth && !isAuthenticated) {
    if (currentPath !== "/login") {
      navigateTo("/login", { replace: true });
    }
    return;
  }

  if (!route.requiresAuth && isAuthPage && isAuthenticated) {
    if (currentPath !== "/") {
      navigateTo("/", { replace: true });
    }
    return;
  }

  app.innerHTML = route.render(route.path);
  applyLayoutEditorPrefillFromQuery(currentPath);

  if (typeof route.onMount === "function") {
    route.onMount(route.path);
  }
}

function safelyRenderCurrentRoute() {
  void renderCurrentRoute().catch((error) => {
    console.error("Route rendering failed:", error);

    const app = document.querySelector("#app");
    if (app) {
      app.innerHTML = `
        <section class="page-container">
          <h1>Något gick fel</h1>
          <p>Kunde inte ladda sidan just nu. Försök igen om en stund.</p>
        </section>
      `;
    }
  });
}

// Initializes simple client-side routing.
export function initRouter() {
  safelyRenderCurrentRoute();
  window.addEventListener("popstate", safelyRenderCurrentRoute);
}

export function navigateTo(path, options = {}) {
  const { replace = false } = options;
  (replace ? window.history.replaceState : window.history.pushState).call(window.history, {}, "", path);
  safelyRenderCurrentRoute();
}