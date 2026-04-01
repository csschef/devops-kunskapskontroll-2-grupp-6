// Main application entry point
// This file initializes the SPA and mounts content into #app

const app = document.getElementById('app');

// Initialize app
function initializeApp() {
  console.log('App initialized');
  // TODO: Set up routing and render initial page
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
