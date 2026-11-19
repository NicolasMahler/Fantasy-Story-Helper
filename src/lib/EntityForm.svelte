<script lang="ts">
  import { rpc } from '../db/client';
  import type { EntityDetail, Attributes } from '../db/entities';
  import type { EntityTypeRow } from '../db/entityTypes';
  import type { BookRow } from '../db/books';
  import MentionTextarea from './MentionTextarea.svelte';

  let {
    seriesId,
    entity = null,
    initialTypeId = null,
    onsaved,
    oncancel,
  }: {
    seriesId: number;
    entity?: EntityDetail | null;
    initialTypeId?: number | null;
    onsaved: (id: number) => void;
    oncancel: () => void;
  } = $props();

  // The form edits a snapshot: it is re-created for each entry (see {#key} in App).
  function initial() {
    return {
      name: entity?.name ?? '',
      typeId: entity?.type.id ?? initialTypeId,
      firstBookId: entity?.first_book_id ?? null,
      description: entity?.description ?? '',
      attributes: { ...(entity?.attributes ?? {}) } as Attributes,
    };
  }
  const start = initial();

  let types = $state<EntityTypeRow[]>([]);
  let books = $state<BookRow[]>([]);
  let name = $state(start.name);
  let typeId = $state<number | null>(start.typeId);
  let firstBookId = $state<number | null>(start.firstBookId);
  let description = $state(start.description);
  let attributes = $state<Attributes>(start.attributes);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const type = $derived(types.find((t) => t.id === typeId));

  async function load() {
    const [t, b] = await Promise.all([rpc('listTypes', seriesId), rpc('listBooks', seriesId)]);
    types = t;
    books = b;
    typeId ??= t.find((x) => x.key === 'character')?.id ?? t[0]?.id ?? null;
  }
  load();

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    if (typeId === null) return;
    if (entity?.type.key === 'event' && type?.key !== 'event'
      && !confirm('Changing this away from Event removes its event details (date, participants). Continue?')) return;
    busy = true;
    error = null;
    // Only keep values for fields the chosen type defines, and store numbers as numbers.
    const attrs: Attributes = {};
    for (const f of type?.fields ?? []) {
      const v = attributes[f.key];
      if (v === undefined || v === '' || v === null) continue;
      attrs[f.key] = f.kind === 'number' ? Number(v) : String(v);
    }
    // Keep values for fields of other types only if the type didn't change.
    const keepOther = entity && entity.type.id === typeId ? entity.attributes : {};
    const merged = { ...keepOther, ...attrs };
    try {
      if (entity) {
        await rpc('updateEntity', entity.id, { name, typeId, firstBookId, description, attributes: merged });
        onsaved(entity.id);
      } else {
        onsaved(await rpc('createEntity', { seriesId, typeId, name, description, firstBookId, attributes: merged }));
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<form class="stack" onsubmit={save}>
  <label>Name <input bind:value={name} required /></label>
  <div class="row">
    <label class="grow">Type
      <select bind:value={typeId}>
        {#each types as t (t.id)}<option value={t.id}>{t.icon} {t.name}</option>{/each}
      </select>
    </label>
    <label class="grow">First appears in
      <select bind:value={firstBookId}>
        <option value={null}>(not set)</option>
        {#each books as b (b.id)}<option value={b.id}>Book {b.number}: {b.title}</option>{/each}
      </select>
    </label>
  </div>

  {#each type?.fields ?? [] as f (f.key)}
    <label>{f.label}
      {#if f.kind === 'longtext'}
        <textarea rows="3" bind:value={attributes[f.key]}></textarea>
      {:else if f.kind === 'number'}
        <input type="number" step="any" bind:value={attributes[f.key]} />
      {:else}
        <input bind:value={attributes[f.key]} />
      {/if}
    </label>
  {/each}

  <div class="field">
    <label for="desc">Description</label>
    <MentionTextarea id="desc" bind:value={description} {seriesId} {types} rows={8} />
  </div>

  {#if error}<p class="error">{error}</p>{/if}
  <div class="row">
    <button class="primary" disabled={busy || !name.trim()}>{entity ? 'Save' : 'Create entry'}</button>
    <button type="button" onclick={oncancel}>Cancel</button>
  </div>
</form>

<style>
  .field { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  .field :global(textarea) { font-size: 1rem; }
</style>
