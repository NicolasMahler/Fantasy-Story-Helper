<script lang="ts">
  import { rpc } from '../db/client';
  import type { BookRow } from '../db/books';
  import {
    STATUSES, STATUS_LABELS, statusForKind,
    type TheoryDetail, type TheoryKind, type TheoryStatus,
  } from '../db/theories';
  import { attempt } from './forms';
  import BookSelect from './BookSelect.svelte';
  import { statusLine } from './theory';

  let { seriesId, theoryId }: { seriesId: number; theoryId: number } = $props();

  let detail = $state<TheoryDetail | null>(null);
  let books = $state<BookRow[]>([]);
  let editing = $state(false);
  let error = $state<string | null>(null);
  let loadError = $state<string | null>(null);

  let kind = $state<TheoryKind>('theory');
  let status = $state<TheoryStatus>('open');
  let bookId = $state<number | null>(null);
  let resolution = $state('');

  async function load() {
    [detail, books] = await Promise.all([rpc('getTheoryDetail', theoryId), rpc('listBooks', seriesId)]);
  }

  /** Opens the form, optionally already set to a new status (the quick "Confirmed"/"Wrong" buttons). */
  function startEdit(to?: TheoryStatus) {
    if (!detail) return;
    kind = detail.kind;
    status = to ?? detail.status;
    // Most things get settled in the book being read now, which is usually the latest one added.
    bookId = detail.resolvedBook?.id ?? books.at(-1)?.id ?? null;
    resolution = detail.resolution;
    error = null;
    editing = true;
  }

  function setKind(k: TheoryKind) {
    kind = k;
    status = statusForKind(k, status);
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    error = null;
    await attempt(async () => {
      await rpc('saveTheory', theoryId, { kind, status, resolvedBookId: bookId, resolution });
      editing = false;
      await load();
    }, (m) => (error = m));
  }

  const settled = (s: TheoryStatus) => s !== 'open';

  attempt(load, (m) => (loadError = m));
</script>

{#if loadError}
  <p class="error" role="alert">Couldn't load the theory: {loadError}</p>
{:else if detail}
  <section class="card theory">
    {#if editing}
      <form class="stack" onsubmit={save}>
        <fieldset class="seg" aria-label="Theory or question">
          <label><input type="radio" name="kind" checked={kind === 'theory'} onchange={() => setKind('theory')} /> Theory: a guess that turns out right or wrong</label>
          <label><input type="radio" name="kind" checked={kind === 'question'} onchange={() => setKind('question')} /> Question: something you want answered</label>
        </fieldset>

        <div class="chips" role="group" aria-label="Status">
          {#each STATUSES[kind] as s (s)}
            <button type="button" class="chip" aria-pressed={status === s} onclick={() => (status = s)}>
              <span class="dot s-{s}" aria-hidden="true"></span>{STATUS_LABELS[s]}
            </button>
          {/each}
        </div>

        {#if settled(status)}
          <label>{status === 'wrong' ? 'Shown wrong in' : status === 'answered' ? 'Answered in' : 'Confirmed in'}
            <BookSelect bind:value={bookId} {books} />
          </label>
          <label>{kind === 'question' ? 'The answer' : 'What happened'}
            <textarea rows="3" bind:value={resolution} placeholder={kind === 'question' ? 'What you found out' : 'How it played out'}></textarea>
          </label>
        {/if}

        {#if error}<p class="error">{error}</p>{/if}
        <div class="row">
          <button class="primary">Save</button>
          <button type="button" onclick={() => (editing = false)}>Cancel</button>
        </div>
      </form>
    {:else}
      <div class="row head">
        <span class="status s-{detail.status}">
          <span class="dot s-{detail.status}" aria-hidden="true"></span>{statusLine(detail)}
        </span>
        <button class="ghost" onclick={() => startEdit()}>Edit</button>
      </div>
      {#if detail.resolution}
        <p class="resolution">{detail.resolution}</p>
      {/if}
      {#if detail.status === 'open'}
        <div class="row quick">
          {#each STATUSES[detail.kind].filter(settled) as s (s)}
            <button class="small" onclick={() => startEdit(s)}><span class="dot s-{s}" aria-hidden="true"></span>{STATUS_LABELS[s]}…</button>
          {/each}
        </div>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .theory { margin: 1rem 0; }
  .head { justify-content: space-between; }
  .status { display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 600; }
  .resolution { margin: 0.5rem 0 0; white-space: pre-wrap; }
  .quick { margin-top: 0.75rem; }
  .small { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 34px; padding: 0.2rem 0.8rem; font-size: 0.9rem; }
  .seg { border: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
  .seg label { display: flex; gap: 0.5rem; align-items: center; font-size: 1rem; }
  .seg input { width: auto; }
  .chips { margin-bottom: 0; }
  .chip { display: inline-flex; align-items: center; gap: 0.4rem; }
  .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex: none; }
  .dot.s-open { border: 2px solid var(--accent); }
  .dot.s-confirmed, .dot.s-answered { background: var(--ok); }
  .dot.s-wrong { background: var(--danger); }
  /* On a highlighted chip the accent fill would hide the open ring, so dots take the chip's text colour. */
  .chip[aria-pressed='true'] .dot.s-open { border-color: currentColor; }
  .chip[aria-pressed='true'] .dot:not(.s-open) { box-shadow: 0 0 0 1.5px currentColor; }
  .status.s-open { color: var(--accent); }
  .status.s-confirmed, .status.s-answered { color: var(--ok); }
  .status.s-wrong { color: var(--danger); }
</style>
