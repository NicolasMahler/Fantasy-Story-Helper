<script lang="ts">
  import Icon from './Icon.svelte';
  import { rpc } from '../db/client';
  import { LINK_KINDS, type LinkRow } from '../db/links';
  import { href } from './route';
  import PickedEntry from './PickedEntry.svelte';
  import { attempt } from './forms';

  let { seriesId, entityId, entityName }: { seriesId: number; entityId: number; entityName: string } = $props();

  let links = $state<LinkRow[]>([]);
  let adding = $state(false);
  let kind = $state('');
  let target = $state<{ id: number; name: string } | null>(null);
  let note = $state('');
  let from = $state<{ id: number; name: string } | null>(null);
  let until = $state<{ id: number; name: string } | null>(null);
  let error = $state<string | null>(null);
  const listId = $props.id();

  async function load() {
    links = await rpc('listLinks', entityId);
  }

  function reset() {
    kind = '';
    target = null;
    note = '';
    from = null;
    until = null;
    error = null;
  }

  async function add(ev: SubmitEvent) {
    ev.preventDefault();
    if (!target) {
      error = 'Choose the other entry.';
      return;
    }
    await attempt(async () => {
      await rpc('createLink', {
        fromId: entityId, toId: target!.id, kind, note, startEventId: from?.id ?? null, endEventId: until?.id ?? null,
      });
      reset();
      adding = false;
      await load();
    }, (m) => (error = m));
  }

  async function remove(l: LinkRow) {
    if (!confirm(`Remove “${l.kind}” between ${entityName} and ${l.other.name}?`)) return;
    await attempt(async () => {
      await rpc('deleteLink', l.id);
      await load();
    }, (m) => alert(`Couldn't remove: ${m}`));
  }

  let loadError = $state<string | null>(null);
  attempt(load, (m) => (loadError = m));
</script>

<section class="etched">
  <h2>Relationships {#if links.length}<span class="count">{links.length}</span>{/if}</h2>
  {#if loadError}<p class="error" role="alert">Couldn't load relationships: {loadError}</p>{/if}
  {#if links.length === 0 && !adding}
    <p class="muted">No relationships yet. Add allies, family, memberships, ownership…</p>
  {/if}
  {#if links.length}
    <ul class="list compact">
      {#each links as l (l.id)}
        <li class="rel">
          <span class="kind">{l.direction === 'out' ? '' : '← '}{l.kind}{l.direction === 'out' ? ' →' : ''}</span>
          <a href={href({ name: 'entity', seriesId, entityId: l.other.id })}><Icon name={l.other.icon} size={14} color={l.other.color} /> {l.other.name}</a>
          {#if l.startEvent || l.endEvent || l.note}
            <small class="muted">
              {#if l.note}{l.note}{/if}
              {#if l.startEvent} · from <a href={href({ name: 'entity', seriesId, entityId: l.startEvent.id })}>{l.startEvent.name}</a>{/if}
              {#if l.endEvent} · until <a href={href({ name: 'entity', seriesId, entityId: l.endEvent.id })}>{l.endEvent.name}</a>{/if}
            </small>
          {/if}
          <button class="ghost x" aria-label={`Remove ${l.kind} ${l.other.name}`} onclick={() => remove(l)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if adding}
    <form class="card stack" onsubmit={add}>
      <div class="row">
        <label class="kind-in">{entityName} is…
          <input list={listId} bind:value={kind} placeholder="e.g. member of" required />
        </label>
        <div class="field grow">
          <span class="lbl">…of / to</span>
          <PickedEntry bind:value={target} {seriesId} exclude={[entityId]} label="Related entry" placeholder="Search entries…" clearLabel="Change" />
        </div>
      </div>
      <details>
        <summary>Note, from / until</summary>
        <div class="stack opt">
          <label>Note <input bind:value={note} placeholder="optional" /></label>
          <div class="row">
            <div class="field grow">
              <span class="lbl">From event</span>
              <PickedEntry bind:value={from} {seriesId} typeKey="event" label="From event" placeholder="optional" emphasis={false} />
            </div>
            <div class="field grow">
              <span class="lbl">Until event</span>
              <PickedEntry bind:value={until} {seriesId} typeKey="event" label="Until event" placeholder="optional" emphasis={false} />
            </div>
          </div>
        </div>
      </details>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="row">
        <button class="primary">Add relationship</button>
        <button type="button" onclick={() => { reset(); adding = false; }}>Cancel</button>
      </div>
    </form>
  {:else}
    <button onclick={() => (adding = true)}>+ Add relationship</button>
  {/if}
  <datalist id={listId}>
    {#each LINK_KINDS as k (k)}<option value={k}></option>{/each}
  </datalist>
</section>

<style>
  .rel { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; padding: 0.2rem 0; }
  .kind { color: #c9a227; min-width: 6.5rem; font-size: 0.88rem; }
  .x { margin-left: auto; min-height: 32px; padding: 0 0.6rem; }
  .kind-in { width: 12rem; }
  .field { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  details summary { cursor: pointer; color: var(--muted); padding: 0.25rem 0; }
  .opt { margin-top: 0.5rem; }
</style>
