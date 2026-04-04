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

// Initializes simple client-side routing.
export function initRouter() {
  renderCurrentRoute();
  window.addEventListener("popstate", renderCurrentRoute);
}

export function navigateTo(path, options = {}) {
  const { replace = false } = options;
  (replace ? window.history.replaceState : window.history.pushState).call(window.history, {}, "", path);
  renderCurrentRoute();
}