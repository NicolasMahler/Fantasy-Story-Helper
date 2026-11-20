<script lang="ts">
  import { rpc } from '../db/client';
  import type { TimelineData } from '../db/timeline';
  import type { EntityTypeRow } from '../db/entityTypes';
  import { filterEvents, type Filters } from './timelineLayout';
  import EntityPicker from './EntityPicker.svelte';
  import TimelineStory from './TimelineStory.svelte';
  import TimelineReading from './TimelineReading.svelte';
  import TimelineChart from './TimelineChart.svelte';

  let { seriesId }: { seriesId: number } = $props();

  type View = 'story' | 'reading' | 'chart';
  const VIEW_KEY = 'fh.timelineView';
  const views: { id: View; label: string }[] = [
    { id: 'story', label: 'Story order' },
    { id: 'reading', label: 'Reading order' },
    { id: 'chart', label: 'Story × reading' },
  ];

  function savedView(): View {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'reading' || v === 'chart' ? v : 'story';
    } catch {
      return 'story';
    }
  }

  let data = $state<TimelineData | null>(null);
  let types = $state<EntityTypeRow[]>([]);
  let view = $state<View>(savedView());
  let picked = $state<{ id: number; name: string; icon: string }[]>([]);
  let typeId = $state<number | null>(null);
  let bookId = $state<number | null>(null);
  /** Which filter control is open. */
  let adding = $state<'character' | 'location' | null>(null);

  let loadError = $state<string | null>(null);

  $effect(() => {
    Promise.all([rpc('getTimeline', seriesId), rpc('listTypes', seriesId)]).then(
      ([d, t]) => {
        data = d;
        types = t;
      },
      (e: Error) => (loadError = `Couldn't load the timeline: ${e.message}`),
    );
  });

  function setView(v: View) {
    view = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ }
  }

  const filters = $derived<Filters>({ entityIds: picked.map((p) => p.id), typeId, bookId });
  const filtered = $derived(data ? filterEvents(data.events, filters) : []);
  const anyFilter = $derived(picked.length > 0 || typeId !== null || bookId !== null);
  const participantTypes = $derived(types.filter((t) => t.key !== 'event'));
</script>

{#if data}
  <div class="seg" role="tablist" aria-label="Timeline view">
    {#each views as v (v.id)}
      <button role="tab" aria-selected={view === v.id} onclick={() => setView(v.id)}>{v.label}</button>
    {/each}
  </div>

  <div class="filters" aria-label="Filters">
    {#each picked as p (p.id)}
      <button class="chip set" onclick={() => (picked = picked.filter((x) => x.id !== p.id))} aria-label={`Remove filter ${p.name}`}>{p.icon} {p.name} ✕</button>
    {/each}
    {#if typeId !== null}
      {@const t = types.find((x) => x.id === typeId)}
      <button class="chip set" onclick={() => (typeId = null)}>Involves {t?.icon} {t?.name} ✕</button>
    {/if}
    {#if bookId !== null}
      {@const b = data.books.find((x) => x.id === bookId)}
      <button class="chip set" onclick={() => (bookId = null)}>Book {b?.number} ✕</button>
    {/if}

    <button class="chip" aria-pressed={adding === 'character'} onclick={() => (adding = adding === 'character' ? null : 'character')}>+ Character</button>
    <button class="chip" aria-pressed={adding === 'location'} onclick={() => (adding = adding === 'location' ? null : 'location')}>+ Location</button>
    {#if typeId === null}
      <select class="chip-select" aria-label="Filter by participant type" onchange={(e) => { const v = e.currentTarget.value; typeId = v ? Number(v) : null; e.currentTarget.value = ''; }}>
        <option value="">+ Type</option>
        {#each participantTypes as t (t.id)}<option value={t.id}>{t.icon} {t.name}</option>{/each}
      </select>
    {/if}
    {#if bookId === null && data.books.length}
      <select class="chip-select" aria-label="Filter by book" onchange={(e) => { const v = e.currentTarget.value; bookId = v ? Number(v) : null; e.currentTarget.value = ''; }}>
        <option value="">+ Book</option>
        {#each data.books as b (b.id)}<option value={b.id}>Book {b.number}: {b.title}</option>{/each}
      </select>
    {/if}
  </div>

  {#if adding}
    <div class="adder">
      <EntityPicker
        {seriesId}
        typeKey={adding}
        exclude={picked.map((p) => p.id)}
        label={`Filter by ${adding}`}
        placeholder={`Search ${adding === 'character' ? 'characters' : 'locations'}…`}
        onpick={(e) => { picked = [...picked, { id: e.id, name: e.name, icon: e.icon }]; adding = null; }}
      />
    </div>
  {/if}

  {#if data.events.length === 0}
    <p class="muted">No events yet. Create entries of type Event, then give them dates in their event details.</p>
  {:else if filtered.length === 0}
    <p class="muted">No events match these filters.</p>
  {:else if view === 'story'}
    <TimelineStory events={filtered} ages={data.ages} {seriesId} />
  {:else if view === 'reading'}
    <TimelineReading events={filtered} books={data.books} {seriesId} filtered={anyFilter} />
  {:else}
    <TimelineChart events={filtered} books={data.books} {seriesId} />
  {/if}

  {#if view !== 'chart' && data.events.length}
    <div class="legend"><span><i></i>In the story</span><span><i class="h"></i>Recounted</span><span>Tap an event for details</span></div>
  {/if}
{:else}
  <p class="muted">{loadError ?? 'Loading timeline…'}</p>
{/if}

<style>
  .seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--border); border-radius: 999px; padding: 2px; margin-bottom: 10px; }
  .seg button { border: none; background: none; border-radius: 999px; min-height: 34px; padding: 0.3rem 0.9rem; font-size: 0.85rem; color: var(--muted); }
  .seg button[aria-selected='true'] { background: var(--accent); color: var(--accent-text); font-weight: 600; }
  .filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .chip { border-radius: 999px; padding: 0.25rem 0.8rem; min-height: 34px; font-size: 0.82rem; color: var(--muted); }
  .chip.set { border-color: var(--accent); color: var(--text); background: color-mix(in srgb, var(--accent) 15%, transparent); }
  .chip[aria-pressed='true'] { border-color: var(--accent); color: var(--text); }
  .chip-select { border-radius: 999px; min-height: 34px; padding: 0.2rem 0.6rem; font-size: 0.82rem; color: var(--muted); width: 6.5rem; }
  .adder { display: flex; margin-bottom: 12px; max-width: 420px; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.75rem; color: var(--muted); margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--border); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); margin-right: 5px; vertical-align: -1px; }
  .legend i.h { background: none; border: 2px dashed var(--muted); }
</style>
