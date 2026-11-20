<script lang="ts">
  import { tick } from 'svelte';
  import { rpc } from '../db/client';
  import { parseAtQuery, formatMention, type AtQuery } from '../db/mentions';
  import type { EntityListItem } from '../db/entities';
  import type { EntityTypeRow } from '../db/entityTypes';
  import { attempt, listKey } from './forms';

  let {
    value = $bindable(''),
    seriesId,
    types,
    rows = 6,
    id,
  }: { value: string; seriesId: number; types: EntityTypeRow[]; rows?: number; id?: string } = $props();

  const listId = $props.id();
  let ta: HTMLTextAreaElement;
  let query = $state<AtQuery | null>(null);
  let results = $state<EntityListItem[]>([]);
  let active = $state(0);
  let creating = $state(false);
  let createTypeId = $state<number | null>(null);
  let error = $state<string | null>(null);
  let seq = 0;

  const typeByKey = $derived(new Map(types.map((t) => [t.key, t])));
  const canCreate = $derived(
    !!query?.term.trim() && !results.some((r) => r.name.toLowerCase() === query!.term.trim().toLowerCase()),
  );
  const optionCount = $derived(results.length + (canCreate ? 1 : 0));
  const open = $derived(!!query && optionCount > 0);

  async function update() {
    const q = parseAtQuery(value.slice(0, ta.selectionStart));
    if (q && q.typeKey && !typeByKey.has(q.typeKey)) {
      // Unknown prefix like "@foo:" — not a query.
      query = null;
      return;
    }
    query = q;
    creating = false;
    error = null;
    if (!q) return;
    const mine = ++seq;
    const found = await rpc('searchEntities', seriesId, q.typeKey, q.term);
    if (mine !== seq) return;
    results = found;
    active = 0;
  }

  async function insert(name: string, entityId: number) {
    if (!query) return;
    const caret = ta.selectionStart;
    const token = formatMention(name, entityId) + ' ';
    value = value.slice(0, query.start) + token + value.slice(caret);
    const pos = query.start + token.length;
    query = null;
    creating = false;
    await tick();
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }

  function choose(i: number) {
    if (i < results.length) insert(results[i].name, results[i].id);
    else startCreate();
  }

  function startCreate() {
    if (!query) return;
    const fromPrefix = query.typeKey ? typeByKey.get(query.typeKey) : undefined;
    createTypeId = fromPrefix?.id ?? types.find((t) => t.key === 'character')?.id ?? types[0]?.id ?? null;
    creating = true;
  }

  async function create() {
    if (!query || createTypeId === null) return;
    const name = query.term.trim();
    const typeId = createTypeId;
    await attempt(async () => insert(name, await rpc('createEntity', { seriesId, typeId, name })), (m) => (error = m));
  }

  function onkeydown(ev: KeyboardEvent) {
    if (creating && ev.key === 'Enter') {
      ev.preventDefault();
      create();
      return;
    }
    if (!open || creating) {
      if (ev.key === 'Escape' && (query || creating)) {
        query = null;
        creating = false;
        ev.preventDefault();
      }
      return;
    }
    const r = listKey(ev.key, active, optionCount, { pickOnTab: true });
    if (r === null) return;
    if (r === 'pick') choose(active);
    else if (r === 'close') query = null;
    else active = r;
    ev.preventDefault();
  }
</script>

<div class="wrap">
  <textarea
    bind:this={ta}
    bind:value
    {id}
    {rows}
    oninput={update}
    onclick={update}
    onkeyup={(e) => (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') && update()}
    {onkeydown}
    onblur={() => setTimeout(() => { if (!creating) query = null; }, 150)}
    role="combobox"
    aria-expanded={open}
    aria-controls={listId}
    aria-autocomplete="list"
  ></textarea>

  {#if query && creating}
    <div class="popup create pop-in" role="dialog" aria-label="Create entry">
      <span>Create <strong>{query.term.trim()}</strong> as</span>
      <select bind:value={createTypeId} aria-label="Type for new entry">
        {#each types as t (t.id)}<option value={t.id}>{t.icon} {t.name}</option>{/each}
      </select>
      <button type="button" class="primary" onmousedown={(e) => e.preventDefault()} onclick={create}>Create</button>
      <button type="button" class="ghost" onclick={() => { creating = false; ta.focus(); }}>Back</button>
      {#if error}<p class="error">{error}</p>{/if}
    </div>
  {:else if open}
    <ul class="popup pop-in" id={listId} role="listbox">
      {#each results as r, i (r.id)}
        <li role="option" aria-selected={i === active}>
          <button type="button" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => choose(i)}>
            <span aria-hidden="true">{r.icon}</span> {r.name} <small class="muted">{r.type_name}</small>
          </button>
        </li>
      {/each}
      {#if canCreate}
        <li role="option" aria-selected={active === results.length}>
          <button type="button" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={startCreate}>
            ＋ Create “{query!.term.trim()}”…
          </button>
        </li>
      {/if}
    </ul>
  {/if}
</div>
<small class="muted">Type <code>@</code> to link an entry. Narrow by type with a prefix like <code>@item:</code></small>

<style>
  .wrap { position: relative; }
  textarea { resize: vertical; min-height: 6rem; }
  .popup {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    z-index: 10;
    margin: 4px 0 0;
    padding: 4px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);
    max-height: 18rem;
    overflow-y: auto;
  }
  li button {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    min-height: 40px;
  }
  [aria-selected='true'] button { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .create { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.5rem; }
  .create .error { width: 100%; }
</style>
