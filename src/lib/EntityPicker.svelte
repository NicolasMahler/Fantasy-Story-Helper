<script lang="ts">
  import Icon from './Icon.svelte';
  import { rpc } from '../db/client';
  import type { EntityListItem } from '../db/entities';
  import { listKey } from './forms';

  let {
    seriesId,
    onpick,
    typeKey = null,
    exclude = [],
    placeholder = 'Search entries…',
    label,
  }: {
    seriesId: number;
    onpick: (item: EntityListItem) => void;
    /** Restrict to one type, e.g. 'event'. */
    typeKey?: string | null;
    exclude?: number[];
    placeholder?: string;
    label: string;
  } = $props();

  const listId = $props.id();
  let term = $state('');
  let results = $state<EntityListItem[]>([]);
  let open = $state(false);
  let active = $state(0);
  let seq = 0;
  const LIMIT = 12;

  async function search() {
    const mine = ++seq;
    const found = await rpc('searchEntities', seriesId, typeKey, term, LIMIT + exclude.length).catch(() => [] as EntityListItem[]);
    if (mine !== seq) return;
    results = found.filter((r) => !exclude.includes(r.id)).slice(0, LIMIT);
    active = 0;
    open = true;
  }

  function pick(item: EntityListItem) {
    onpick(item);
    term = '';
    open = false;
  }

  function onkeydown(ev: KeyboardEvent) {
    if (!open) return;
    const r = listKey(ev.key, active, results.length);
    if (r === null) return;
    if (r === 'pick') pick(results[active]);
    else if (r === 'close') open = false;
    else active = r;
    ev.preventDefault();
  }
</script>

<div class="picker">
  <input
    type="search"
    bind:value={term}
    {placeholder}
    aria-label={label}
    oninput={search}
    onfocus={search}
    {onkeydown}
    onblur={() => setTimeout(() => (open = false), 150)}
    role="combobox"
    aria-expanded={open}
    aria-controls={listId}
    aria-autocomplete="list"
  />
  {#if open}
    <ul class="popup pop-in" role="listbox" id={listId}>
      {#each results as r, i (r.id)}
        <li role="option" aria-selected={i === active}>
          <button type="button" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => pick(r)}>
            <Icon name={r.icon} size={15} color={r.color} /> {r.name}
            {#if r.alias}<small class="aka">aka {r.alias}</small>{/if}
            <small class="muted">{r.type_name}</small>
          </button>
        </li>
      {:else}
        <li class="muted empty">No matches</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker { position: relative; flex: 1 1 12rem; min-width: 0; }
  .popup {
    position: absolute; left: 0; right: 0; top: 100%; z-index: 10; margin: 4px 0 0; padding: 4px;
    list-style: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.2); max-height: 16rem; overflow-y: auto;
  }
  li button { width: 100%; text-align: left; border: none; background: none; min-height: 40px; }
  [aria-selected='true'] button { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .empty { padding: 0.5rem; }
</style>
