<script lang="ts">
  import { rpc } from '../db/client';
  import type { EntityDetail, EntityListItem } from '../db/entities';
  import { href } from './route';
  import RichText from './RichText.svelte';
  import EntityForm from './EntityForm.svelte';

  let { seriesId, entityId }: { seriesId: number; entityId: number } = $props();

  let entity = $state<EntityDetail | null | undefined>(undefined);
  let mentionedIn = $state<EntityListItem[]>([]);
  let editing = $state(false);

  async function load() {
    [entity, mentionedIn] = await Promise.all([rpc('getEntity', entityId), rpc('backlinks', entityId)]);
  }

  async function remove() {
    if (!entity) return;
    const n = mentionedIn.length;
    const extra = n ? ` ${n} ${n === 1 ? 'entry links' : 'entries link'} to it; those links will become plain text.` : '';
    if (!confirm(`Delete “${entity.name}”?${extra} This can't be undone.`)) return;
    await rpc('deleteEntity', entityId);
    location.hash = href({ name: 'series', seriesId, tab: 'entries' });
  }

  load();
</script>

<a class="back" href={href({ name: 'series', seriesId, tab: 'entries' })}>← Entries</a>

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

  <div class="row">
    <button class="primary" onclick={() => (editing = true)}>Edit</button>
    <button class="danger" onclick={remove}>Delete</button>
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
    <p class="card muted">Dates, participants and the past/present toggle for events come in the next build step.</p>
  {/if}

  <section>
    <h2>Mentioned in</h2>
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
  .row { margin: 1rem 0; }
  .fields { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0 0 1rem; }
  .fields dt { color: var(--muted); }
  .fields dd { margin: 0; }
  .pre { white-space: pre-wrap; }
  section { margin: 1.5rem 0; }
  h2 { font-size: 1.1rem; }
  @media (max-width: 480px) { .fields { grid-template-columns: 1fr; } }
</style>
