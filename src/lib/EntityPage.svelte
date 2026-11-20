<script lang="ts">
  import { rpc } from '../db/client';
  import type { EntityDetail, EntityListItem } from '../db/entities';
  import { href } from './route';
  import RichText from './RichText.svelte';
  import EntityForm from './EntityForm.svelte';
  import EventPanel from './EventPanel.svelte';
  import Relationships from './Relationships.svelte';
  import type { EntityEvent } from '../db/events';
  import { attempt } from './forms';

  let { seriesId, entityId }: { seriesId: number; entityId: number } = $props();

  let entity = $state<EntityDetail | null | undefined>(undefined);
  let mentionedIn = $state<EntityListItem[]>([]);
  let events = $state<EntityEvent[]>([]);
  let editing = $state(false);
  /** Bumped after edits so the event panel reloads (e.g. type changed to/from Event). */
  let version = $state(0);

  async function load() {
    [entity, mentionedIn, events] = await Promise.all([
      rpc('getEntity', entityId), rpc('backlinks', entityId), rpc('eventsForEntity', entityId),
    ]);
    version++;
  }

  async function remove() {
    if (!entity) return;
    const n = mentionedIn.length;
    const extra = n ? ` ${n} ${n === 1 ? 'entry links' : 'entries link'} to it; those links will become plain text.` : '';
    if (!confirm(`Delete “${entity.name}”?${extra} This can't be undone.`)) return;
    const ok = await attempt(() => rpc('deleteEntity', entityId), (m) => alert(`Couldn't delete: ${m}`));
    if (ok) location.hash = href({ name: 'series', seriesId, tab: 'entries' });
  }

  load();
</script>

<div class="topbar">
  <a class="back" href={href({ name: 'series', seriesId, tab: 'entries' })}>← Entries</a>
  {#if entity && !editing}
    <div class="actions">
      <button class="small" onclick={() => (editing = true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4M13.5 6.5l4 4" /></svg>Edit
      </button>
      <button class="small danger" onclick={remove}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>Delete
      </button>
    </div>
  {/if}
</div>

{#if entity === null}
  <p>This entry doesn't exist (it may have been deleted).</p>
{:else if entity && editing}
  <h1>Edit {entity.name}</h1>
  <EntityForm
    {seriesId}
    {entity}
    onsaved={async () => { editing = false; await load(); }}
    oncancel={() => (editing = false)}
  />
{:else if entity}
  <div class="head" style:--c={entity.type.color}>
    <span class="badge">{entity.type.icon} {entity.type.name}</span>
    <h1>{entity.name}</h1>
    {#if entity.firstBook}
      <p class="muted">First appears in Book {entity.firstBook.number}: {entity.firstBook.title}</p>
    {/if}
  </div>

  {#if entity.type.fields.some((f) => entity!.attributes[f.key] !== undefined)}
    <dl class="card fields">
      {#each entity.type.fields as f (f.key)}
        {#if entity.attributes[f.key] !== undefined}
          <dt>{f.label}</dt>
          <dd class:pre={f.kind === 'longtext'}>{entity.attributes[f.key]}</dd>
        {/if}
      {/each}
    </dl>
  {/if}

  <section>
    {#if entity.description.trim()}
      <RichText text={entity.description} links={entity.links} {seriesId} />
    {:else}
      <p class="muted">No description yet.</p>
    {/if}
  </section>

  {#if entity.type.key === 'event'}
    {#key version}<EventPanel {seriesId} eventId={entityId} />{/key}
  {/if}

  {#if events.length}
    <section class="etched">
      <h2>Events <span class="count">{events.length}</span></h2>
      <ul class="list compact">
        {#each events as ev, i (`${ev.eventId}:${ev.role}:${i}`)}
          <li class="ev" class:recounted={ev.mode === 'recounted'}>
            <span class="marker" aria-hidden="true">{ev.mode === 'present' ? '●' : '◌'}</span>
            <a href={href({ name: 'entity', seriesId, entityId: ev.eventId })}>{ev.name}</a>
            <small class="muted">{ev.label}{ev.bookNumber ? ` · Book ${ev.bookNumber}` : ''}{ev.role !== 'participant' ? ` · ${ev.role}` : ''}</small>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <Relationships {seriesId} {entityId} entityName={entity.name} />

  <section class="etched">
    <h2>Mentioned in {#if mentionedIn.length}<span class="count">{mentionedIn.length}</span>{/if}</h2>
    {#if mentionedIn.length === 0}
      <p class="muted">Nothing links here yet.</p>
    {:else}
      <ul class="list compact">
        {#each mentionedIn as m (m.id)}
          <li><a href={href({ name: 'entity', seriesId, entityId: m.id })}>{m.icon} {m.name}</a> <small class="muted">{m.type_name}</small></li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .head h1 { margin: 0.25rem 0; }
  .head p { margin: 0; }
  .badge {
    display: inline-block;
    font-size: 0.85rem;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c) 22%, transparent);
  }
  /* Edit and Delete sit quietly in the top right, beside the back link. */
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.25rem; }
  .topbar .back { margin: 0; }
  .actions { display: flex; gap: 0.5rem; }
  .small { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 34px; padding: 0.2rem 0.7rem; font-size: 0.85rem; }
  .small svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .head { margin-bottom: 1rem; }
  .fields { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0 0 1rem; }
  .fields dt { color: var(--muted); }
  .fields dd { margin: 0; }
  .pre { white-space: pre-wrap; }
  section { margin: 1.5rem 0; }
  .ev { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; }
  .marker { color: var(--accent); }
  .recounted .marker { color: var(--muted); }
  .recounted a { font-style: italic; }
  @media (max-width: 480px) { .fields { grid-template-columns: 1fr; } }
</style>
