// Main application entry point
// This file initializes the SPA and mounts content into #app
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import { initRouter, navigateTo } from "./router/router.js";
import { onAuthStateChange } from "./auth-service.js";

// Initialize app
function initializeApp() {
  console.log('App initialized');
  // Start the router which renders the correct page
  initRouter();

  onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    const isAuthenticated = Boolean(session?.user);
    const path = window.location.pathname;
    const isAuthPage = /^\/(login|register)\/?$/.test(path);
    const isPublicPath = path === "/" || isAuthPage;

    if (!isAuthenticated && !isPublicPath) {
      navigateTo("/login", { replace: true });
      return;
    }

    if (isAuthenticated && isAuthPage) {
      navigateTo("/", { replace: true });
    }
  });
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
