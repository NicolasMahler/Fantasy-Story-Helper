<script lang="ts">
  import { db, type StartupInfo } from './db/client';
  import { parseRoute, href } from './lib/route';
  import SeriesList from './lib/SeriesList.svelte';
  import Settings from './lib/Settings.svelte';
  import SeriesPage from './lib/SeriesPage.svelte';
  import EntityPage from './lib/EntityPage.svelte';
  import EntityForm from './lib/EntityForm.svelte';
  import SearchOverlay from './lib/SearchOverlay.svelte';
  import { update, applyUpdate, dismissUpdate } from './lib/update.svelte';

  let info = $state<StartupInfo | null>(null);
  let error = $state<string | null>(null);
  let hash = $state(location.hash);
  const route = $derived(parseRoute(hash));
  const currentSeries = $derived('seriesId' in route ? route.seriesId : null);
  /** Changes when a different page opens, so its content fades in. Series tabs fade on their own inside SeriesPage. */
  const pageKey = $derived(route.name === 'series' ? `series:${route.seriesId}` : hash);
  let searchOpen = $state(false);
  let headerH = $state(52);
  $effect(() => document.documentElement.style.setProperty('--header-h', `${headerH}px`));

  function onGlobalKey(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]');
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      searchOpen = true;
    }
  }

  db.init().then((i) => (info = i), (e: Error) => (error = e.message));

  $effect(() => {
    const onHash = () => {
      hash = location.hash;
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

<svelte:window onkeydown={onGlobalKey} />
<SearchOverlay bind:open={searchOpen} seriesId={currentSeries} />

<header bind:clientHeight={headerH}>
  <a class="brand" href="#/">Fantasy Helper</a>
  <nav>
    <button class="search" onclick={() => (searchOpen = true)} aria-label="Search (/ or Ctrl+K)" title="Search (/ or Ctrl+K)">🔍<span class="label"> Search</span></button>
    <a href="#/" aria-current={route.name === 'library' ? 'page' : undefined}>Library</a>
    <a href="#/settings" aria-current={route.name === 'settings' ? 'page' : undefined}>Settings</a>
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
  {#key pageKey}<div class="page-in">
  {#if error}
    <p class="card">Couldn't open the database: {error}</p>
  {:else if !info}
    <p class="muted">Opening your library…</p>
  {:else if route.name === 'library'}
    <SeriesList />
  {:else if route.name === 'settings'}
    <Settings bind:info />
  {:else if route.name === 'series'}
    {#key route.seriesId}<SeriesPage seriesId={route.seriesId} tab={route.tab} />{/key}
  {:else if route.name === 'entity'}
    {#key route.entityId}<EntityPage seriesId={route.seriesId} entityId={route.entityId} />{/key}
  {:else if route.name === 'newEntity'}
    <a class="back" href={href({ name: 'series', seriesId: route.seriesId, tab: 'entries' })}>← Back to entries</a>
    <h1>New entry</h1>
    <EntityForm
      seriesId={route.seriesId}
      initialTypeId={route.typeId}
      onsaved={(id) => (location.hash = href({ name: 'entity', seriesId: route.seriesId, entityId: id }))}
      oncancel={() => history.back()}
    />
  {:else}
    <p>Page not found. <a href="#/">Go to the library</a>.</p>
  {/if}
  </div>{/key}
</main>

{#if update.ready}
  <div class="update" role="status">
    <span>A new version of Fantasy Helper is ready.</span>
    <div class="row tight">
      <button class="primary" onclick={applyUpdate}>Reload</button>
      <button onclick={dismissUpdate}>Later</button>
    </div>
  </div>
{/if}

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 16px;
    background: var(--surface);
    box-shadow: 0 4px 10px var(--shade-dark);
    position: sticky;
    top: 0;
    z-index: 20;
    padding-top: max(0.75rem, env(safe-area-inset-top));
  }
  .brand { font-weight: 700; color: var(--text); text-decoration: none; }
  nav { display: flex; gap: 1rem; align-items: center; }
  .search { min-height: 36px; padding: 0.2rem 0.7rem; font-size: 0.85rem; color: var(--muted); border-radius: 999px; }
  @media (max-width: 420px) { .search .label { display: none; } nav { gap: 0.75rem; } }
  nav a { text-decoration: none; color: var(--muted); padding: 0.5rem 0; }
  nav a[aria-current='page'] { color: var(--text); font-weight: 600; }
  .banner { background: var(--warn-bg); color: var(--warn-text); padding: 0.75rem 16px; }
  main { max-width: 760px; margin: 0 auto; padding: 1rem 16px 3rem; }
  .update {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
    max-width: 560px;
    margin: 0 auto;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.75rem 0.75rem 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
  }
  .update .row.tight { gap: 0.5rem; }
</style>
