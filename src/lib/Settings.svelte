<script lang="ts">
  import { db, type StartupInfo } from '../db/client';
  import { download, backupName } from './download';

  let { info = $bindable() }: { info: StartupInfo } = $props();

  let status = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  const storageLabel = {
    opfs: 'On this device',
    locked: 'Temporary (open in another tab)',
    memory: 'Temporary (not supported by this browser)',
  } as const;

  async function exportSqlite() {
    download((await db.exportSqlite()) as Uint8Array<ArrayBuffer>, backupName('sqlite'), 'application/vnd.sqlite3');
    status = 'Database file downloaded.';
  }

  async function exportJson() {
    const dump = await db.exportJson();
    download(JSON.stringify(dump, null, 2), backupName('json'), 'application/json');
    status = 'JSON backup downloaded.';
  }

  async function importSqlite(ev: Event) {
    const file = (ev.currentTarget as HTMLInputElement).files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (!confirm(`Replace ALL current data with “${file.name}”? Export a backup first if you're unsure.`)) return;
    try {
      const next = await db.importSqlite(new Uint8Array(await file.arrayBuffer()));
      info = { ...info, ...next };
      status = 'Import complete.';
    } catch (e) {
      status = `Import failed, and your existing data is unchanged. ${(e as Error).message}`;
    }
  }
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
    <dt>Schema version</dt><dd>{info.schemaVersion}</dd>
    <dt>SQLite</dt><dd>{info.sqliteVersion}</dd>
  </dl>
</section>

<section class="card">
  <h2>Backup</h2>
  <p class="muted">Your data exists only in this browser. Export regularly.</p>
  <div class="row">
    <button class="primary" onclick={exportSqlite}>Export database (.sqlite)</button>
    <button onclick={exportJson}>Export JSON</button>
  </div>
  <h3>Restore</h3>
  <p class="muted">Replaces everything with a previously exported <code>.sqlite</code> file.</p>
  <input bind:this={fileInput} type="file" accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3" onchange={importSqlite} disabled={info.storage !== 'opfs'} />
</section>

{#if status}<p role="status">{status}</p>{/if}

<style>
  section { margin-bottom: 1rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
  h3 { margin: 1rem 0 0.25rem; font-size: 1rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  @media (max-width: 480px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 0.5rem; } }
</style>
