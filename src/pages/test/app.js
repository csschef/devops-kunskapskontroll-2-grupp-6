import { renderCreateStoreLayoutPage } from './index.js';

const app = document.getElementById('app');

if (!app) {
  // Allow this module to be imported on pages without an #app container.
} else {
  app.innerHTML = renderCreateStoreLayoutPage();
}
