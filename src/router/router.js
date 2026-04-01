import { resolveRoute } from "./routes.js";

function renderCurrentRoute() {
  const app = document.querySelector("#app");

  if (!app) {
    return;
  }

  const route = resolveRoute(window.location.pathname);
  app.innerHTML = route.render(route.path);
}

// Initializes simple client-side routing.
export function initRouter() {
  renderCurrentRoute();
  window.addEventListener("popstate", renderCurrentRoute);
}

export function navigateTo(path) {
  window.history.pushState({}, "", path);
  renderCurrentRoute();
}