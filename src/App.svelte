<script lang="ts">
  import { db, type StartupInfo } from './db/client';
  import SeriesList from './lib/SeriesList.svelte';
  import Settings from './lib/Settings.svelte';

  let info = $state<StartupInfo | null>(null);
  let error = $state<string | null>(null);
  let route = $state(location.hash || '#/');

  db.init().then((i) => (info = i), (e: Error) => (error = e.message));

  $effect(() => {
    const onHash = () => (route = location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

<header>
  <a class="brand" href="#/">Fantasy Helper</a>
  <nav>
    <a href="#/" aria-current={route === '#/' ? 'page' : undefined}>Library</a>
    <a href="#/settings" aria-current={route === '#/settings' ? 'page' : undefined}>Settings</a>
  </nav>
</header>

{#if info && info.storage !== 'opfs'}
  <div class="banner" role="alert">
    {#if info.storage === 'locked'}
      Fantasy Helper is already open in another tab or window. Changes made here <strong>won't be saved</strong>, so close this one.
    {:else}
      This browser can't store data on the device. Changes <strong>won't be saved</strong> after you close the page.
    {/if}
  </div>
{/if}

<main>
  {#if error}
    <p class="card">Couldn't open the database: {error}</p>
  {:else if !info}
    <p class="muted">Opening your library…</p>
  {:else if route === '#/settings'}
    <Settings bind:info />
  {:else}
    <SeriesList />
  {/if}
</main>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .brand { font-weight: 700; color: var(--text); text-decoration: none; }
  nav { display: flex; gap: 1rem; }
  nav a { text-decoration: none; color: var(--muted); padding: 0.5rem 0; }
  nav a[aria-current='page'] { color: var(--text); font-weight: 600; }
  .banner { background: var(--warn-bg); color: var(--warn-text); padding: 0.75rem 16px; }
  main { max-width: 720px; margin: 0 auto; padding: 1rem 16px 3rem; }
</style>
