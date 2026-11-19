import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { db } from './db/client';

// Dev-only console handle for poking at the database.
if (import.meta.env.DEV) (window as unknown as { db: typeof db }).db = db;

export default mount(App, { target: document.getElementById('app')! });
