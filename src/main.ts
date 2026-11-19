import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { db } from './db/client';

// Dev-only console handle for poking at the database.
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.db = db;
  // Run `await loadMalazanSample()` in the console to add a sample series.
  w.loadMalazanSample = () => import('./dev/malazanSample').then((m) => m.loadMalazanSample());
}

export default mount(App, { target: document.getElementById('app')! });
