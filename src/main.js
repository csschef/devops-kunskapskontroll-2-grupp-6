// Main application entry point
// This file initializes the SPA and mounts content into #app
import { initRouter } from "./router/router.js";

// Initialize app
function initializeApp() {
  console.log('App initialized');
  // Start the router which renders the correct page
  initRouter();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
