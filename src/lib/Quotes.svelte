<script lang="ts">
  import Icon from './Icon.svelte';
  import { rpc } from '../db/client';
  import type { BookRow } from '../db/books';
  import type { QuoteRow, Stance } from '../db/quotes';
  import { href } from './route';
  import EntityPicker from './EntityPicker.svelte';
  import { attempt } from './forms';

  let { seriesId, entityId, isTheory }: { seriesId: number; entityId: number; isTheory: boolean } = $props();

  let quotes = $state<QuoteRow[]>([]);
  let spoken = $state<QuoteRow[]>([]);
  let books = $state<BookRow[]>([]);
  /** null = form closed, 'new' = adding, a number = editing that quote. */
  let editing = $state<number | 'new' | null>(null);
  let error = $state<string | null>(null);

  let text = $state('');
  let bookId = $state<number | null>(null);
  let chapter = $state('');
  let speaker = $state<{ id: number; name: string } | null>(null);
  let note = $state('');
  let stance = $state<Stance | null>(null);

  const forCount = $derived(quotes.filter((q) => q.stance === 'for').length);
  const againstCount = $derived(quotes.filter((q) => q.stance === 'against').length);

  async function load() {
    [quotes, spoken, books] = await Promise.all([
      rpc('listQuotes', entityId), rpc('quotesBy', entityId), rpc('listBooks', seriesId),
    ]);
  }

  function open(q?: QuoteRow, as?: Stance) {
    text = q?.text ?? '';
    // New quotes usually come from the book being read now, which is usually the latest one added.
    bookId = q ? (q.book?.id ?? null) : (books.at(-1)?.id ?? null);
    chapter = q?.chapter ?? '';
    speaker = q?.speaker ? { id: q.speaker.id, name: q.speaker.name } : null;
    note = q?.note ?? '';
    stance = q ? q.stance : (as ?? null);
    error = null;
    editing = q ? q.id : 'new';
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    error = null;
    const input = { text, bookId, chapter, speakerId: speaker?.id ?? null, note, stance: isTheory ? stance : null };
    await attempt(async () => {
      if (editing === 'new') await rpc('createQuote', { entityId, ...input });
      else if (editing !== null) await rpc('updateQuote', editing, input);
      editing = null;
      await load();
    }, (m) => (error = m));
  }

  async function remove(q: QuoteRow) {
    if (!confirm('Remove this quote?')) return;
    await attempt(async () => {
      await rpc('deleteQuote', q.id);
      if (editing === q.id) editing = null;
      await load();
    }, (m) => alert(`Couldn't remove: ${m}`));
  }

  /** "Book 1, Ch. 12" / "Ch. 12" / "Book 1". */
  const where = (q: QuoteRow) => [q.book ? `Book ${q.book.number}` : '', q.chapter].filter(Boolean).join(', ');

  const STANCE_LABEL: Record<Stance, string> = { for: 'Supports', against: 'Against' };

  $effect(() => {
    entityId;
    load();
  });
</script>

{#snippet form()}
  <form class="card stack" onsubmit={save}>
    <label>Quote
      <textarea rows="3" bind:value={text} placeholder="The line from the book" required></textarea>
    </label>
    {#if isTheory}
      <fieldset class="seg" aria-label="How it bears on the theory">
        <label><input type="radio" name="stance" checked={stance === 'for'} onchange={() => (stance = 'for')} /> Supports it</label>
        <label><input type="radio" name="stance" checked={stance === 'against'} onchange={() => (stance = 'against')} /> Against it</label>
        <label><input type="radio" name="stance" checked={stance === null} onchange={() => (stance = null)} /> Neither</label>
      </fieldset>
    {/if}
    <div class="row">
      <label class="grow">Book
        <select bind:value={bookId}>
          <option value={null}>(no book)</option>
          {#each books as b (b.id)}<option value={b.id}>Book {b.number}: {b.title}</option>{/each}
        </select>
      </label>
      <label class="ch">Chapter / page <input bind:value={chapter} placeholder="e.g. Ch. 12" /></label>
    </div>
    <div class="field">
      <span class="lbl">Said by</span>
      {#if speaker}
        <div class="row"><strong>{speaker.name}</strong><button type="button" class="ghost" onclick={() => (speaker = null)}>Clear</button></div>
      {:else}
        <EntityPicker {seriesId} label="Said by" placeholder="optional, search entries…" onpick={(e) => (speaker = { id: e.id, name: e.name })} />
      {/if}
    </div>
    <label>Note <input bind:value={note} placeholder="optional: why it matters" /></label>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="row">
      <button class="primary">{editing === 'new' ? 'Add quote' : 'Save'}</button>
      <button type="button" onclick={() => (editing = null)}>Cancel</button>
    </div>
  </form>
{/snippet}

{#snippet quote(q: QuoteRow, filedUnder: boolean)}
  <div class="quote" class:for={q.stance === 'for'} class:against={q.stance === 'against'}>
    {#if isTheory && q.stance && !filedUnder}<span class="stance">{STANCE_LABEL[q.stance]}</span>{/if}
    <blockquote>{q.text}</blockquote>
    <div class="cite muted">
      {#if q.speaker && !filedUnder}— <a href={href({ name: 'entity', seriesId, entityId: q.speaker.id })}>{q.speaker.name}</a>{/if}
      {#if filedUnder}on <a href={href({ name: 'entity', seriesId, entityId: q.entry.id })}><Icon name={q.entry.icon} size={13} color={q.entry.color} /> {q.entry.name}</a>{/if}
      {#if where(q)}<span>{(q.speaker && !filedUnder) || filedUnder ? ' · ' : ''}{where(q)}</span>{/if}
    </div>
    {#if q.note}<p class="note">{q.note}</p>{/if}
    {#if !filedUnder}
      <div class="tools">
        <button class="ghost" onclick={() => open(q)} aria-label="Edit quote">Edit</button>
        <button class="ghost x" onclick={() => remove(q)} aria-label="Remove quote">✕</button>
      </div>
    {/if}
  </div>
{/snippet}

<section class="etched">
  <h2>
    {isTheory ? 'Evidence' : 'Quotes'}
    {#if quotes.length}<span class="count">{isTheory && (forCount || againstCount) ? `${forCount} for · ${againstCount} against` : quotes.length}</span>{/if}
  </h2>
  {#if quotes.length === 0 && editing !== 'new'}
    <p class="muted">{isTheory ? 'No evidence yet. Add the lines that back this up or cut against it.' : 'No quotes yet. Keep the lines worth remembering.'}</p>
  {/if}
  {#each quotes as q (q.id)}
    {#if editing === q.id}{@render form()}{:else}{@render quote(q, false)}{/if}
  {/each}

  {#if editing === 'new'}
    {@render form()}
  {:else if isTheory}
    <div class="row">
      <button onclick={() => open(undefined, 'for')}>+ Supports it</button>
      <button onclick={() => open(undefined, 'against')}>+ Against it</button>
    </div>
  {:else}
    <button onclick={() => open()}>+ Add quote</button>
  {/if}
</section>

{#if spoken.length}
  <section class="etched">
    <h2>Their words <span class="count">{spoken.length}</span></h2>
    {#each spoken as q (q.id)}{@render quote(q, true)}{/each}
  </section>
{/if}

<style>
  .quote { position: relative; margin: 0 0 0.9rem; padding: 0.1rem 0 0.1rem 0.9rem; border-left: 3px solid var(--border); }
  .quote.for { border-left-color: var(--ok); }
  .quote.against { border-left-color: var(--danger); }
  blockquote { margin: 0; white-space: pre-wrap; font-style: italic; padding-right: 5.5rem; }
  .cite { font-size: 0.85rem; margin-top: 0.2rem; }
  .note { margin: 0.25rem 0 0; font-size: 0.92rem; white-space: pre-wrap; }
  .stance { display: inline-block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.15rem; }
  .for .stance { color: var(--ok); }
  .against .stance { color: var(--danger); }
  .tools { position: absolute; top: 0; right: 0; display: flex; }
  .tools button { min-height: 32px; padding: 0 0.6rem; font-size: 0.85rem; }
  .seg { border: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
  .seg label { display: flex; gap: 0.4rem; align-items: center; font-size: 1rem; }
  .seg input { width: auto; }
  .ch { width: 10rem; }
  .field { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  form { margin-bottom: 0.9rem; }
</style>
