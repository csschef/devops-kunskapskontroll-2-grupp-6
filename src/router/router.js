import { resolveRoute } from "./routes.js";
import { getCurrentSession } from "../auth-service.js";

async function renderCurrentRoute() {
  const app = document.querySelector("#app");
  if (!app) return;

  const currentPath = window.location.pathname;
  const route = resolveRoute(currentPath);
  const session = await getCurrentSession();
  const isAuthenticated = Boolean(session?.user);
  const isAuthPage = currentPath.startsWith("/login") || currentPath.startsWith("/register");

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