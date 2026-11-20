<script lang="ts">
  import { plural } from './text';
  import { rpc } from '../db/client';
  import { FIELD_KINDS, slugify, type EntityTypeRow, type TypeInput } from '../db/entityTypes';
  import { attempt } from './forms';

  let { seriesId }: { seriesId: number } = $props();

  let types = $state<EntityTypeRow[]>([]);
  /** id of the type being edited, 'new' for a new one, null when closed. */
  let editing = $state<number | 'new' | null>(null);
  let draft = $state<TypeInput>({ name: '', icon: '', color: '#888888', fields: [] });
  let error = $state<string | null>(null);

  async function load() {
    types = await rpc('listTypes', seriesId);
  }

  function open(t: EntityTypeRow | null) {
    error = null;
    editing = t ? t.id : 'new';
    draft = t
      ? { name: t.name, icon: t.icon, color: t.color, fields: t.fields.map((f) => ({ ...f })) }
      : { name: '', icon: '', color: '#888888', fields: [] };
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    error = null;
    // New fields get their key from the label; existing fields keep theirs so stored values stay attached.
    const input = { ...draft, fields: draft.fields.map((f) => ({ ...f, key: f.key || slugify(f.label) })) };
    await attempt(async () => {
      if (editing === 'new') await rpc('createType', seriesId, input);
      else if (editing !== null) await rpc('updateType', editing, input);
      editing = null;
      await load();
    }, (m) => (error = m));
  }

  async function remove(t: EntityTypeRow) {
    if (!confirm(`Delete the “${t.name}” type?`)) return;
    await attempt(async () => {
      await rpc('deleteType', t.id);
      editing = null;
      await load();
    }, (m) => (error = m));
  }

  load();
</script>

<p class="muted">Type <code>@key:</code> in a description to search only that type.</p>

<ul class="list">
  {#each types as t (t.id)}
    <li class="card">
      {#if editing === t.id}
        {@render editor(t)}
      {:else}
        <div class="type-row">
          <span class="swatch" style:background={t.color}>{t.icon}</span>
          <div class="grow">
            <strong>{t.name}</strong> <code class="muted">@{t.key}:</code>
            <small class="muted">
              {plural(t.usage, 'entry', 'entries')}{t.fields.length ? ` · ${t.fields.map((f) => f.label).join(', ')}` : ''}{t.is_builtin ? ' · built-in' : ''}
            </small>
          </div>
          <button class="ghost" onclick={() => open(t)}>Edit</button>
        </div>
      {/if}
    </li>
  {/each}
</ul>

{#if editing === 'new'}
  <div class="card">{@render editor(null)}</div>
{:else}
  <button onclick={() => open(null)}>Add a custom type</button>
{/if}

{#snippet editor(t: EntityTypeRow | null)}
  <form class="stack" onsubmit={save}>
    <div class="row">
      <label class="icon-in">Icon <input bind:value={draft.icon} maxlength="4" placeholder="⛵" /></label>
      <label class="grow">Name <input bind:value={draft.name} required /></label>
      <label>Color <input type="color" bind:value={draft.color} /></label>
    </div>
    <fieldset>
      <legend>Extra fields</legend>
      {#each draft.fields as f, i (i)}
        <div class="row">
          <input class="grow" bind:value={f.label} placeholder="Label, e.g. Allegiance" aria-label="Field label" />
          <select bind:value={f.kind} aria-label="Field kind">
            {#each FIELD_KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
          </select>
          <button type="button" class="ghost" aria-label="Remove field" onclick={() => draft.fields.splice(i, 1)}>✕</button>
        </div>
      {/each}
      <button type="button" class="ghost" onclick={() => draft.fields.push({ key: '', label: '', kind: 'text' })}>+ Add field</button>
    </fieldset>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="row">
      <button class="primary">Save</button>
      <button type="button" onclick={() => (editing = null)}>Cancel</button>
      {#if t && !t.is_builtin}
        <button type="button" class="danger push" disabled={t.usage > 0} title={t.usage > 0 ? 'In use' : ''} onclick={() => remove(t)}>Delete type</button>
      {/if}
    </div>
  </form>
{/snippet}

<style>
  .type-row { display: flex; align-items: center; gap: 0.75rem; }
  .type-row .grow { display: grid; }
  .swatch {
    width: 2.25rem; height: 2.25rem; border-radius: 8px; display: grid; place-items: center; flex: none;
    font-size: 1.1rem;
  }
  .icon-in { width: 5rem; }
  fieldset { border: 1px solid var(--border); border-radius: var(--radius); display: grid; gap: 0.5rem; }
  .push { margin-left: auto; }
  input[type='color'] { padding: 0.15rem; height: 44px; width: 3.5rem; }
</style>
