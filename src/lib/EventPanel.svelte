<script lang="ts">
  import { rpc } from '../db/client';
  import type { EventDetail, EventInput, EventMode } from '../db/events';
  import { ROLE_SUGGESTIONS } from '../db/events';
  import type { AgeRow, BucketRow } from '../db/calendar';
  import type { BookRow } from '../db/books';
  import { DATE_PRECISIONS, type DatePrecision } from '../db/dates';
  import { href } from './route';
  import EntityPicker from './EntityPicker.svelte';
  import { attempt, numOrNull } from './forms';

  let { seriesId, eventId }: { seriesId: number; eventId: number } = $props();

  let detail = $state<EventDetail | null>(null);
  let ages = $state<AgeRow[]>([]);
  let books = $state<BookRow[]>([]);
  let buckets = $state<BucketRow[]>([]);
  let editing = $state(false);
  let error = $state<string | null>(null);
  let pError = $state<string | null>(null);
  let newRole = $state('');

  // Form draft. Number inputs bind as `number | null` (null when blank).
  let mode = $state<EventMode>('present');
  let bookId = $state<number | null>(null);
  let toldBy = $state<{ id: number; name: string } | null>(null);
  let precision = $state<DatePrecision | null>(null);
  let year = $state<number | null>(null);
  let ageId = $state<number | null>(null);
  let relTarget = $state<{ id: number; name: string } | null>(null);
  let relYears = $state<number | null>(0);
  let relDir = $state<1 | -1>(1);
  let bucket = $state<string | null>(null);
  let pin = $state<number | null>(null);
  let tiebreak = $state<number | null>(0);

  async function load() {
    [detail, ages, books, buckets] = await Promise.all([
      rpc('getEventDetail', eventId), rpc('listAges', seriesId), rpc('listBooks', seriesId), rpc('listBuckets', seriesId),
    ]);
  }

  function startEdit() {
    if (!detail) return;
    const d = detail;
    mode = d.mode;
    bookId = d.book?.id ?? null;
    toldBy = d.toldBy;
    precision = d.datePrecision;
    year = d.year;
    ageId = d.ageId;
    relTarget = d.relativeTarget;
    relYears = Math.abs(d.offsetYears ?? 0);
    relDir = (d.offsetYears ?? 0) < 0 ? -1 : 1;
    bucket = d.bucket ?? buckets[0]?.bucket ?? null;
    pin = d.sortKeyOverride;
    tiebreak = d.manualOrder;
    error = null;
    editing = true;
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    error = null;
    const input: EventInput = {
      mode,
      bookId,
      toldById: toldBy?.id ?? null,
      datePrecision: precision,
      year: numOrNull(year),
      ageId,
      relativeTo: relTarget?.id ?? null,
      offsetYears: (numOrNull(relYears) ?? 0) * relDir,
      bucket,
      sortKeyOverride: numOrNull(pin), // blank = not pinned
      manualOrder: numOrNull(tiebreak) ?? 0,
    };
    await attempt(async () => {
      await rpc('saveEvent', eventId, input);
      editing = false;
      await load();
    }, (m) => (error = m));
  }

  async function participantOp(fn: () => Promise<unknown>) {
    pError = null;
    await attempt(async () => {
      await fn();
      await load();
    }, (m) => (pError = m));
  }

  load();
</script>

{#if detail}
  <section class="card event">
    {#if editing}
      <form class="stack" onsubmit={save}>
        <fieldset class="seg" aria-label="How the story shows this event">
          <label><input type="radio" bind:group={mode} value="present" /> Happens in the story</label>
          <label><input type="radio" bind:group={mode} value="recounted" /> Recounted (memory, legend, vision…)</label>
        </fieldset>

        {#if mode === 'recounted'}
          <div class="field">
            <span class="lbl">Told by</span>
            {#if toldBy}
              <div class="row"><strong>{toldBy.name}</strong><button type="button" class="ghost" onclick={() => (toldBy = null)}>Clear</button></div>
            {:else}
              <EntityPicker {seriesId} label="Told by" placeholder="Who tells or remembers it?" onpick={(e) => (toldBy = { id: e.id, name: e.name })} />
            {/if}
          </div>
        {/if}

        <label>{mode === 'recounted' ? 'Described in' : 'Happens in'}
          <select bind:value={bookId}>
            <option value={null}>(no book)</option>
            {#each books as b (b.id)}<option value={b.id}>Book {b.number}: {b.title}</option>{/each}
          </select>
        </label>

        <label>Date
          <select bind:value={precision}>
            {#each DATE_PRECISIONS as p (p.label)}<option value={p.value}>{p.label}</option>{/each}
          </select>
        </label>

        {#if precision === 'year'}
          <div class="row">
            <label class="grow">Year <input type="number" step="1" bind:value={year} required /></label>
            <label class="grow">of
              <select bind:value={ageId}>
                <option value={null}>(no age)</option>
                {#each ages as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
              </select>
            </label>
          </div>
        {:else if precision === 'age'}
          {#if ages.length === 0}
            <p class="muted">No ages yet. Add them in the <a href={href({ name: 'series', seriesId, tab: 'calendar' })}>Calendar</a> tab.</p>
          {:else}
            <label>Age
              <select bind:value={ageId}>
                <option value={null} disabled>Choose…</option>
                {#each ages as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
              </select>
            </label>
          {/if}
        {:else if precision === 'relative'}
          <div class="row">
            <label class="years">Years <input type="number" min="0" step="1" bind:value={relYears} /></label>
            <label>&nbsp;
              <select bind:value={relDir}>
                <option value={1}>after</option>
                <option value={-1}>before</option>
              </select>
            </label>
            <div class="field grow">
              <span class="lbl">Event</span>
              {#if relTarget}
                <div class="row"><strong>{relTarget.name}</strong><button type="button" class="ghost" onclick={() => (relTarget = null)}>Change</button></div>
              {:else}
                <EntityPicker {seriesId} typeKey="event" exclude={[eventId]} label="Relative to event" placeholder="Search events…" onpick={(e) => (relTarget = { id: e.id, name: e.name })} />
              {/if}
            </div>
          </div>
          <small class="muted">Use 0 years for “the same year as”.</small>
        {:else if precision === 'bucket'}
          <label>When
            <select bind:value={bucket}>
              {#each buckets as b (b.bucket)}<option value={b.bucket}>{b.label}</option>{/each}
            </select>
          </label>
        {/if}

        <details>
          <summary>Advanced ordering</summary>
          <div class="row">
            <label class="grow">Pin position (years) <input type="number" step="any" bind:value={pin} placeholder="computed" /></label>
            <label class="grow">Tiebreak order <input type="number" step="1" bind:value={tiebreak} /></label>
          </div>
          <small class="muted">A pin overrides the computed position on the timeline. Tiebreak orders events at the same position (lower first).</small>
        </details>

        {#if error}<p class="error">{error}</p>{/if}
        <div class="row">
          <button class="primary">Save event details</button>
          <button type="button" onclick={() => (editing = false)}>Cancel</button>
        </div>
      </form>
    {:else}
      <div class="row head">
        <span class="mode" class:recounted={detail.mode === 'recounted'}>
          {detail.mode === 'present' ? '● In the story' : '◌ Recounted'}
        </span>
        <button class="ghost" onclick={startEdit}>Edit details</button>
      </div>
      <dl>
        <dt>When</dt>
        <dd>
          {detail.label}
          {#if detail.relativeTarget}
            <a href={href({ name: 'entity', seriesId, entityId: detail.relativeTarget.id })} aria-label={`Open ${detail.relativeTarget.name}`}>↗</a>
          {/if}
          {#if detail.effectiveKey !== null}<small class="muted"> · position {detail.effectiveKey}</small>{/if}
        </dd>
        <dt>{detail.mode === 'recounted' ? 'Described in' : 'Happens in'}</dt>
        <dd>{detail.book ? `Book ${detail.book.number}: ${detail.book.title}` : '(no book)'}</dd>
        {#if detail.toldBy}
          <dt>Told by</dt>
          <dd><a href={href({ name: 'entity', seriesId, entityId: detail.toldBy.id })}>{detail.toldBy.icon} {detail.toldBy.name}</a></dd>
        {/if}
      </dl>
    {/if}
  </section>

  <section class="etched">
    <h2>Participants {#if detail.participants.length}<span class="count">{detail.participants.length}</span>{/if}</h2>
    {#if detail.participants.length === 0}
      <p class="muted">No one linked yet. Add the characters, places and things involved.</p>
    {:else}
      <ul class="list compact">
        {#each detail.participants as p (p.id)}
          <li class="row p">
            <a class="grow" href={href({ name: 'entity', seriesId, entityId: p.entityId })}>{p.icon} {p.name}</a>
            <input
              class="role"
              list="role-suggestions"
              value={p.role}
              aria-label={`Role of ${p.name}`}
              onchange={(e) => participantOp(() => rpc('updateParticipantRole', p.id, e.currentTarget.value))}
            />
            <button class="ghost" aria-label={`Remove ${p.name}`} onclick={() => participantOp(() => rpc('removeParticipant', p.id))}>✕</button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="row add">
      <EntityPicker
        {seriesId}
        exclude={[eventId]}
        label="Add participant"
        placeholder="Add a participant…"
        onpick={(e) => participantOp(async () => { await rpc('addParticipant', eventId, e.id, newRole || undefined); newRole = ''; })}
      />
      <input class="role" list="role-suggestions" bind:value={newRole} placeholder="role (auto)" aria-label="Role for new participant" />
    </div>
    <datalist id="role-suggestions">
      {#each ROLE_SUGGESTIONS as r (r)}<option value={r}></option>{/each}
    </datalist>
    {#if pError}<p class="error">{pError}</p>{/if}
  </section>
{/if}

<style>
  .event { margin: 1rem 0; }
  .head { justify-content: space-between; }
  .mode { font-weight: 600; color: var(--accent); }
  .mode.recounted { color: var(--muted); font-style: italic; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0.5rem 0 0; }
  dt { color: var(--muted); }
  dd { margin: 0; }
  .seg { border: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
  .seg label { display: flex; gap: 0.5rem; align-items: center; font-size: 1rem; }
  .seg input { width: auto; }
  .field { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  .lbl { font-size: 0.9rem; }
  .years { width: 6rem; }
  details summary { cursor: pointer; color: var(--muted); padding: 0.25rem 0; }
  details .row { margin-top: 0.5rem; }
  .role { width: 9rem; flex: none; }
  .p { padding: 0.15rem 0; flex-wrap: nowrap; }
  .p .grow { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p button { flex: none; padding-inline: 0.6rem; }
  @media (max-width: 480px) { .role { width: 8.25rem; } }
  .add { margin-top: 0.5rem; }
  @media (max-width: 480px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 0.4rem; } }
</style>
