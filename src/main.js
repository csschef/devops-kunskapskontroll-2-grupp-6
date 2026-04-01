// Main application entry point
// This file initializes the SPA and mounts content into #app

// Initialize app
function initializeApp() {
  const app = document.getElementById('app');
  console.log('App initialized');
  // TODO: Set up routing and render initial page
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
