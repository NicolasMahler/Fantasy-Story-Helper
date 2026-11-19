<script lang="ts">
  import { rpc } from '../db/client';
  import type { AgeRow, AgeInput, BucketRow } from '../db/calendar';

  let { seriesId }: { seriesId: number } = $props();

  let ages = $state<AgeRow[]>([]);
  let buckets = $state<BucketRow[]>([]);
  /** id of the age being edited, 'new', or null */
  let editing = $state<number | 'new' | null>(null);
  let draft = $state({ name: '', startYear: '', endYear: '', direction: 'forward' as AgeInput['direction'] });
  let error = $state<string | null>(null);
  let bucketDrafts = $state<Record<string, { label: string; sortKey: string }>>({});
  let bucketMsg = $state<string | null>(null);

  async function load() {
    [ages, buckets] = await Promise.all([rpc('listAges', seriesId), rpc('listBuckets', seriesId)]);
    bucketDrafts = Object.fromEntries(buckets.map((b) => [b.bucket, { label: b.label, sortKey: String(b.sort_key) }]));
  }

  function open(a: AgeRow | null) {
    error = null;
    editing = a ? a.id : 'new';
    draft = a
      ? { name: a.name, startYear: String(a.start_year), endYear: a.end_year === null ? '' : String(a.end_year), direction: a.direction }
      : { name: '', startYear: '', endYear: '', direction: 'forward' };
  }

  const toInt = (s: string) => (s.trim() === '' ? Number.NaN : Number(s));

  async function saveAge(ev: SubmitEvent) {
    ev.preventDefault();
    error = null;
    const input: AgeInput = {
      name: draft.name,
      startYear: toInt(draft.startYear),
      endYear: draft.endYear.trim() === '' ? null : toInt(draft.endYear),
      direction: draft.direction,
    };
    try {
      if (editing === 'new') await rpc('createAge', seriesId, input);
      else if (editing !== null) await rpc('updateAge', editing, input);
      editing = null;
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function removeAge(a: AgeRow) {
    if (!confirm(`Delete the age “${a.name}”?`)) return;
    try {
      await rpc('deleteAge', a.id);
      editing = null;
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function saveBucket(b: BucketRow) {
    bucketMsg = null;
    const d = bucketDrafts[b.bucket];
    try {
      await rpc('updateBucket', seriesId, b.bucket, { label: d.label, sortKey: Number(d.sortKey === '' ? Number.NaN : d.sortKey) });
      await load();
      bucketMsg = `Saved “${d.label}”.`;
    } catch (e) {
      bucketMsg = (e as Error).message;
    }
  }

  const range = (a: AgeRow) =>
    a.end_year === null ? `from ${a.start_year}` : `${a.start_year} → ${a.end_year}`;

  load();
</script>

<section>
  <h2>Ages</h2>
  <p class="muted">
    Dates are written as “Year X of an Age”. The start year places the age on one shared timeline (in years).
    Backward ages count down from their start, like years “before” an epoch.
  </p>

  {#if ages.length === 0 && editing !== 'new'}
    <p class="muted">No ages yet. Events can still use plain years, relative dates or vague dates.</p>
  {/if}

  <ul class="list">
    {#each ages as a (a.id)}
      <li class="card">
        {#if editing === a.id}
          {@render ageForm(a)}
        {:else}
          <div class="row">
            <div class="grow">
              <strong>{a.name}</strong>
              <small class="muted">{range(a)} · counts {a.direction === 'forward' ? 'up' : 'down'} · {a.usage} {a.usage === 1 ? 'event' : 'events'}</small>
            </div>
            <button class="ghost" onclick={() => open(a)}>Edit</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if editing === 'new'}
    <div class="card">{@render ageForm(null)}</div>
  {:else}
    <button onclick={() => open(null)}>Add an age</button>
  {/if}
  {#if error && editing === null}<p class="error">{error}</p>{/if}
</section>

<section>
  <h2>Vague dates</h2>
  <p class="muted">Where “long ago”-style dates sit on the timeline, in years. Lower is earlier.</p>
  <ul class="list">
    {#each buckets as b (b.bucket)}
      {#if bucketDrafts[b.bucket]}
        <li class="card">
          <form class="row" onsubmit={(e) => { e.preventDefault(); saveBucket(b); }}>
            <label class="grow">Label <input bind:value={bucketDrafts[b.bucket].label} /></label>
            <label class="pos">Position <input type="number" step="any" bind:value={bucketDrafts[b.bucket].sortKey} /></label>
            <button class="ghost save">Save</button>
          </form>
          <small class="muted">{b.bucket} · {b.usage} {b.usage === 1 ? 'event' : 'events'}</small>
        </li>
      {/if}
    {/each}
  </ul>
  {#if bucketMsg}<p role="status">{bucketMsg}</p>{/if}
</section>

{#snippet ageForm(a: AgeRow | null)}
  <form class="stack" onsubmit={saveAge}>
    <label>Name <input bind:value={draft.name} required placeholder="e.g. Third Age" /></label>
    <div class="row">
      <label class="grow">Start year <input type="number" step="1" bind:value={draft.startYear} required /></label>
      <label class="grow">End year <input type="number" step="1" bind:value={draft.endYear} placeholder="optional" /></label>
      <label class="grow">Years count
        <select bind:value={draft.direction}>
          <option value="forward">Up (Year 1, 2, 3…)</option>
          <option value="backward">Down (before an epoch)</option>
        </select>
      </label>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="row">
      <button class="primary">Save</button>
      <button type="button" onclick={() => (editing = null)}>Cancel</button>
      {#if a}<button type="button" class="danger push" onclick={() => removeAge(a)}>Delete age</button>{/if}
    </div>
  </form>
{/snippet}

<style>
  section { margin-bottom: 2rem; }
  h2 { font-size: 1.1rem; margin-bottom: 0.25rem; }
  .row .grow { display: grid; }
  .pos { width: 9rem; }
  .save { align-self: flex-end; }
  .push { margin-left: auto; }
</style>
