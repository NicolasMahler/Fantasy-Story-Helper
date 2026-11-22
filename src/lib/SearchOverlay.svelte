<script lang="ts">
  import Icon from './Icon.svelte';
  import { tick } from 'svelte';
  import { rpc } from '../db/client';
  import type { SearchResult } from '../db/search';
  import { href } from './route';
  import { listKey } from './forms';

  let { open = $bindable(false), seriesId }: { open: boolean; seriesId: number | null } = $props();

  let q = $state('');
  let allSeries = $state(false);
  let results = $state<SearchResult[]>([]);
  let active = $state(0);
  let input = $state<HTMLInputElement | null>(null);
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scope = $derived(seriesId !== null && !allSeries ? seriesId : null);

  $effect(() => {
    if (open) tick().then(() => input?.select());
  });

  $effect(() => {
    const query = q;
    const s = scope;
    clearTimeout(timer);
    if (!query.trim()) {
      seq++; // a search still in flight must not fill the list back in
      results = [];
      return;
    }
    timer = setTimeout(async () => {
      const mine = ++seq;
      const r = await rpc('search', { seriesId: s, q: query, limit: 40 }).catch(() => [] as SearchResult[]);
      if (mine !== seq) return;
      results = r;
      active = 0;
    }, 120);
  });

  function target(r: SearchResult): string {
    switch (r.kind) {
      case 'entity': return href({ name: 'entity', seriesId: r.seriesId, entityId: r.id });
      case 'book': return href({ name: 'series', seriesId: r.seriesId, tab: 'books' });
      case 'age': return href({ name: 'series', seriesId: r.seriesId, tab: 'calendar' });
      case 'series': return href({ name: 'series', seriesId: r.id, tab: 'entries' });
    }
  }

  function go(r: SearchResult) {
    location.hash = target(r);
    open = false;
  }

  function onkeydown(ev: KeyboardEvent) {
    const r = listKey(ev.key, active, results.length);
    if (r === null) return;
    if (r === 'close') open = false;
    else if (r === 'pick') go(results[active]);
    else active = r;
    ev.preventDefault();
  }

  const fieldLabel = (r: SearchResult) =>
    r.field === 'name' || r.field === 'title' || r.field === 'also known as' ? r.typeName : `${r.typeName} · ${r.field}`;
</script>

{#if open}
  <div class="backdrop" role="presentation" onclick={() => (open = false)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Search">
    <div class="bar">
      <Icon name="search" size={18} />
      <input
        bind:this={input}
        bind:value={q}
        {onkeydown}
        type="search"
        placeholder={scope !== null ? 'Search this series…' : 'Search everything…'}
        aria-label="Search"
        aria-controls="search-results"
        role="combobox"
        aria-expanded={results.length > 0}
        autocomplete="off"
      />
      <button class="ghost" onclick={() => (open = false)} aria-label="Close search">Esc</button>
    </div>
    {#if seriesId !== null}
      <label class="scope"><input type="checkbox" bind:checked={allSeries} /> Search all series</label>
    {/if}

    {#if q.trim() && results.length === 0}
      <p class="muted empty">No matches for “{q.trim()}”.</p>
    {:else if results.length}
      <ul id="search-results" role="listbox">
        {#each results as r, i (`${r.kind}:${r.id}`)}
          <li role="option" aria-selected={i === active}>
            <a href={target(r)} onclick={() => (open = false)} onmouseenter={() => (active = i)}>
              <span class="icon" style:--c={r.color} aria-hidden="true"><Icon name={r.icon} size={16} /></span>
              <span class="body">
                <span class="name">{r.name}</span>
                <small class="muted">{fieldLabel(r)}</small>
                {#if r.snippet}
                  <span class="snippet">{r.snippet.text.slice(0, r.snippet.start)}<mark>{r.snippet.text.slice(r.snippet.start, r.snippet.start + r.snippet.length)}</mark>{r.snippet.text.slice(r.snippet.start + r.snippet.length)}</span>
                {/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted empty">Names, other names, descriptions, fields, relationships, quotes, books and ages. ↑ ↓ to move, Enter to open.</p>
    {/if}
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.45); z-index: 40; animation: page-in 0.16s var(--ease); }
  .dialog {
    position: fixed; z-index: 41; left: 50%; top: max(8vh, env(safe-area-inset-top));
    transform: translateX(-50%); width: min(640px, calc(100vw - 24px)); max-height: 80vh; display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
    overflow: hidden; transform-origin: top center; animation: dialog-in 0.18s var(--ease);
  }
  /* Keeps the centering translate while growing in. */
  @keyframes dialog-in { from { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.98); } }
  .bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  .bar input { border: none; background: none; font-size: 1.05rem; padding: 0.5rem 0.25rem; }
  .bar input:focus-visible { outline: none; }
  .bar button { min-height: 32px; font-size: 0.8rem; color: var(--muted); }
  .scope { display: flex; gap: 6px; align-items: center; font-size: 0.82rem; color: var(--muted); padding: 6px 14px 0; }
  .scope input { width: auto; }
  ul { list-style: none; margin: 0; padding: 6px; overflow-y: auto; }
  li a {
    display: flex; gap: 10px; padding: 8px 10px; border-radius: 10px; text-decoration: none; color: var(--text); align-items: flex-start;
  }
  [aria-selected='true'] a { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .icon {
    flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
    background: color-mix(in srgb, var(--c) 30%, transparent);
  }
  .body { display: grid; gap: 1px; min-width: 0; }
  .name { font-weight: 600; }
  .snippet { font-size: 0.85rem; color: var(--muted); overflow-wrap: anywhere; }
  mark { background: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--text); border-radius: 3px; padding: 0 1px; }
  .empty { padding: 14px; margin: 0; font-size: 0.9rem; }
</style>
