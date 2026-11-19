<script lang="ts">
  import { db, rpc, type StartupInfo } from '../db/client';
  import type { SeriesRow } from '../db/series';
  import type { BackupStatus } from '../db/meta';
  import { download, backupName } from './download';
  import { install, promptInstall } from './install.svelte';
  import { timeAgo } from './timeAgo';
  import { attempt } from './forms';
  import { slugify } from './text';

  let { info = $bindable() }: { info: StartupInfo } = $props();

  let status = $state<string | null>(null);
  let series = $state<SeriesRow[]>([]);
  let backup = $state<BackupStatus | null>(null);
  let seriesToExport = $state<number | null>(null);
  let jsonMode = $state<'add' | 'replace'>('add');
  let sqliteInput: HTMLInputElement;
  let jsonInput: HTMLInputElement;

  const storageLabel = {
    opfs: 'On this device',
    locked: 'Temporary (open in another tab)',
    memory: 'Temporary (not supported by this browser)',
  } as const;

  async function refresh() {
    [series, backup] = await Promise.all([rpc('listSeries'), rpc('backupStatus')]);
    seriesToExport ??= series[0]?.id ?? null;
  }

  const exportFailed = (m: string) => (status = `Export failed. ${m}`);

  const exportSqlite = () => attempt(async () => {
    download((await db.exportSqlite()) as Uint8Array<ArrayBuffer>, backupName('sqlite'), 'application/vnd.sqlite3');
    status = 'Database file downloaded.';
    await refresh();
  }, exportFailed);

  const exportJson = () => attempt(async () => {
    download(JSON.stringify(await db.exportJson(), null, 2), backupName('json'), 'application/json');
    status = 'JSON backup downloaded.';
    await refresh();
  }, exportFailed);

  const exportSeries = () => attempt(async () => {
    if (seriesToExport === null) return;
    const dump = await db.exportJson(seriesToExport);
    const slug = slugify(dump.seriesName ?? '', 'series');
    download(JSON.stringify(dump, null, 2), `${slug}-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    status = `“${dump.seriesName}” exported. Import it elsewhere with “Add as new series”.`;
  }, exportFailed);

  function pick(input: HTMLInputElement): File | null {
    const file = input.files?.[0] ?? null;
    input.value = '';
    return file;
  }

  async function importSqlite() {
    const file = pick(sqliteInput);
    if (!file) return;
    if (!confirm(`Replace ALL current data with “${file.name}”? Export a backup first if you're unsure.`)) return;
    try {
      const next = await db.importSqlite(new Uint8Array(await file.arrayBuffer()));
      info = { ...info, ...next };
      status = 'Import complete.';
      await refresh();
    } catch (e) {
      status = `Import failed, and your existing data is unchanged. ${(e as Error).message}`;
    }
  }

  async function importJson() {
    const file = pick(jsonInput);
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      status = 'That file is not valid JSON.';
      return;
    }
    if (jsonMode === 'replace' && !confirm(`Replace ALL current data with “${file.name}”? Export a backup first if you're unsure.`)) return;
    try {
      const r = await db.importJson(raw, jsonMode);
      status = r.mode === 'replace'
        ? 'Import complete. Your data was replaced.'
        : `Added ${r.seriesIds.length} series to your library.`;
      await refresh();
    } catch (e) {
      status = `Import failed, and your existing data is unchanged. ${(e as Error).message}`;
    }
  }

  refresh();
</script>

<h1>Settings</h1>

<section class="card">
  <h2>Storage</h2>
  <dl>
    <dt>Where data lives</dt><dd>{storageLabel[info.storage]}</dd>
    <dt>Protected from cleanup</dt>
    <dd>
      {info.persisted ? 'Yes' : 'No'}{#if !info.persisted}<span class="muted">. The browser may clear it when space runs low. Installing the app to your home screen helps, and so do regular backups.</span>{/if}
    </dd>
    <dt>Last backup</dt>
    <dd>
      {#if backup?.lastExportAt}{timeAgo(backup.lastExportAt)}{:else}Never{/if}
    </dd>
    <dt>Schema version</dt><dd>{info.schemaVersion}</dd>
    <dt>SQLite</dt><dd>{info.sqliteVersion}</dd>
  </dl>
</section>

<section class="card">
  <h2>Install</h2>
  {#if install.installed}
    <p>Installed. Fantasy Helper runs as its own app.</p>
  {:else if install.canPrompt}
    <p class="muted">Install Fantasy Helper as an app. It opens without browser bars and the browser is far less likely to clear its data.</p>
    <button class="primary" onclick={promptInstall}>Install app</button>
  {:else if install.ios}
    <p class="muted">On iPhone or iPad: tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.</p>
  {:else}
    <p class="muted">Use your browser's menu (“Install app” or “Add to Home Screen”) to install Fantasy Helper.</p>
  {/if}
</section>

<section class="card">
  <h2>Back up</h2>
  <p class="muted">Your data exists only in this browser. Export regularly.</p>
  <div class="row">
    <button class="primary" onclick={exportSqlite}>Export database (.sqlite)</button>
    <button onclick={exportJson}>Export everything (JSON)</button>
  </div>
  {#if series.length}
    <h3>One series</h3>
    <div class="row">
      <select bind:value={seriesToExport} aria-label="Series to export">
        {#each series as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
      <button onclick={exportSeries}>Export series (JSON)</button>
    </div>
    <p class="muted small">Good for moving a series to another device: import it there with “Add as new series”.</p>
  {/if}
</section>

<section class="card">
  <h2>Restore</h2>
  <h3>From JSON</h3>
  <fieldset class="modes">
    <label><input type="radio" bind:group={jsonMode} value="add" /> <span><strong>Add as new series</strong>: keep everything here and add the file's series alongside it.</span></label>
    <label><input type="radio" bind:group={jsonMode} value="replace" /> <span><strong>Replace everything</strong>: wipe current data and restore the file exactly.</span></label>
  </fieldset>
  <input bind:this={jsonInput} type="file" accept=".json,application/json" onchange={importJson} aria-label="Import JSON file" />

  <h3>From a database file</h3>
  <p class="muted small">Replaces everything with a previously exported <code>.sqlite</code> file.</p>
  <input bind:this={sqliteInput} type="file" accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3" onchange={importSqlite} disabled={info.storage !== 'opfs'} aria-label="Import database file" />
</section>

{#if status}<p role="status" class="status">{status}</p>{/if}

<style>
  section { margin-bottom: 1rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
  h3 { margin: 1rem 0 0.4rem; font-size: 0.95rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; }
  .small { font-size: 0.85rem; margin: 0.4rem 0 0; }
  .modes { border: none; padding: 0; margin: 0 0 0.6rem; display: grid; gap: 0.5rem; }
  .modes label { display: flex; gap: 0.6rem; align-items: flex-start; }
  .modes input { width: auto; margin-top: 0.3rem; }
  .status { position: sticky; bottom: 1rem; background: var(--surface); border: 1px solid var(--accent); border-radius: var(--radius); padding: 0.6rem 0.8rem; }
  @media (max-width: 480px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 0.5rem; } }
</style>
