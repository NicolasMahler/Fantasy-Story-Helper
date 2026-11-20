import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import './lib/install.svelte'; // registers the install-prompt listener early
import './lib/update.svelte'; // registers the service worker and watches for new versions
import { db } from './db/client';

// Dev-only console handle for poking at the database.
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.db = db;
  // Run `await loadMalazanSample()` in the console to add a sample series.
  w.loadMalazanSample = () => import('./samples/malazanBook1').then((m) => m.loadMalazanSample());
}

export default mount(App, { target: document.getElementById('app')! });
