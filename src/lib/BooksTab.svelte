<script lang="ts">
  import { rpc } from '../db/client';
  import type { BookRow } from '../db/books';

  let { seriesId, onchange }: { seriesId: number; onchange?: () => void } = $props();

  let books = $state<BookRow[]>([]);
  let title = $state('');
  let editingId = $state<number | null>(null);
  let editTitle = $state('');
  let error = $state<string | null>(null);

  async function load() {
    books = await rpc('listBooks', seriesId);
    onchange?.();
  }

  async function run(fn: () => Promise<unknown>) {
    error = null;
    try {
      await fn();
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function add(ev: SubmitEvent) {
    ev.preventDefault();
    run(async () => {
      await rpc('addBook', seriesId, title);
      title = '';
    });
  }

  function saveTitle(ev: SubmitEvent, id: number) {
    ev.preventDefault();
    run(async () => {
      await rpc('updateBook', id, editTitle);
      editingId = null;
    });
  }

  function remove(b: BookRow) {
    const uses = b.entities + b.events;
    const extra = uses ? ` ${uses} ${uses === 1 ? 'entry refers' : 'entries refer'} to it and will lose that reference.` : '';
    if (!confirm(`Delete Book ${b.number}, “${b.title}”?${extra}`)) return;
    run(() => rpc('deleteBook', b.id));
  }

  load();
</script>

{#if books.length === 0}
  <p class="muted">No books yet. Add them in reading order.</p>
{:else}
  <ol class="list">
    {#each books as b, i (b.id)}
      <li class="card book">
        <span class="num">{b.number}</span>
        {#if editingId === b.id}
          <form class="grow row" onsubmit={(e) => saveTitle(e, b.id)}>
            <input class="grow" bind:value={editTitle} aria-label="Book title" />
            <button class="primary">Save</button>
            <button type="button" onclick={() => (editingId = null)}>Cancel</button>
          </form>
        {:else}
          <div class="grow">
            <strong>{b.title}</strong>
            <small class="muted">{b.entities} first appearances</small>
          </div>
          <div class="row tight">
            <button class="ghost" disabled={i === 0} onclick={() => run(() => rpc('moveBook', b.id, -1))} aria-label="Move earlier">↑</button>
            <button class="ghost" disabled={i === books.length - 1} onclick={() => run(() => rpc('moveBook', b.id, 1))} aria-label="Move later">↓</button>
            <button class="ghost" onclick={() => { editingId = b.id; editTitle = b.title; }}>Rename</button>
            <button class="ghost danger" onclick={() => remove(b)}>Delete</button>
          </div>
        {/if}
      </li>
    {/each}
  </ol>
{/if}

<form class="row add" onsubmit={add}>
  <input class="grow" bind:value={title} placeholder={`Book ${books.length + 1} title`} aria-label="New book title" />
  <button class="primary" disabled={!title.trim()}>Add book</button>
</form>
{#if error}<p class="error">{error}</p>{/if}

<style>
  .book { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .book .grow { display: grid; }
  .num { font-weight: 700; color: var(--muted); min-width: 1.5rem; text-align: right; }
  .add { margin-top: 1rem; }
</style>
