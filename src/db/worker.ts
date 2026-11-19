/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { SqlDb } from './types';
import { migrate } from './migrations';
import { api } from './api';
import { dumpJson } from './dump';
import type { InitInfo, Ops, OpName, Request, Response, StorageMode } from './protocol';

const VFS_NAME = 'fantasy-helper';
const DB_FILE = '/fantasy-helper.sqlite3';
const SQLITE_HEADER = 'SQLite format 3\0';

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type Pool = Awaited<ReturnType<Sqlite3['installOpfsSAHPoolVfs']>>;
type Oo1Db = InstanceType<Sqlite3['oo1']['DB']>;

let sqlite3: Sqlite3;
let pool: Pool | null = null;
let raw: Oo1Db;
let db: SqlDb;
let storage: StorageMode = 'memory';

function wrap(d: Oo1Db): SqlDb {
  return {
    exec(sql, params) {
      if (params?.length) d.exec({ sql, bind: params as never });
      else d.exec(sql);
    },
    query<T>(sql: string, params?: unknown[]) {
      return d.exec({
        sql,
        bind: (params?.length ? params : undefined) as never,
        rowMode: 'object',
        returnValue: 'resultRows',
      }) as T[];
    },
    transaction(fn) {
      let out!: ReturnType<typeof fn>;
      d.savepoint(() => {
        out = fn();
      });
      return out;
    },
  };
}

function openDb(): InitInfo {
  raw = pool ? new pool.OpfsSAHPoolDb(DB_FILE) : new sqlite3.oo1.DB(':memory:', 'c');
  raw.exec('PRAGMA foreign_keys = ON');
  db = wrap(raw);
  const schemaVersion = migrate(db);
  return { storage, schemaVersion, sqliteVersion: sqlite3.version.libVersion };
}

function opfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.storage?.getDirectory &&
    typeof FileSystemFileHandle !== 'undefined' &&
    'createSyncAccessHandle' in FileSystemFileHandle.prototype
  );
}

async function init(): Promise<InitInfo> {
  if (raw) return { storage, schemaVersion: migrate(db), sqliteVersion: sqlite3.version.libVersion };
  sqlite3 = await sqlite3InitModule();
  if (opfsSupported()) {
    try {
      pool = await sqlite3.installOpfsSAHPoolVfs({ name: VFS_NAME });
      storage = 'opfs';
    } catch (e) {
      // Sync access handles are exclusive: most often another tab has the DB open.
      console.warn('OPFS pool unavailable', e);
      storage = 'locked';
    }
  }
  return openDb();
}

async function importSqlite(bytes: Uint8Array): Promise<InitInfo> {
  const header = new TextDecoder().decode(bytes.subarray(0, 16));
  if (header !== SQLITE_HEADER) throw new Error('That file is not an SQLite database.');
  if (!pool) throw new Error('Import needs on-device storage, which is not available in this tab.');

  const backup = sqlite3.capi.sqlite3_js_db_export(raw);
  raw.close();
  try {
    await pool.importDb(DB_FILE, bytes);
    const info = openDb();
    const fk = db.query('PRAGMA foreign_key_check');
    const ok = db.query<{ integrity_check: string }>('PRAGMA integrity_check')[0]?.integrity_check;
    if (ok !== 'ok' || fk.length) throw new Error('The imported database failed its integrity check.');
    return info;
  } catch (e) {
    // Put the previous database back so a bad import never loses data.
    try { raw?.close(); } catch { /* already closed */ }
    await pool.importDb(DB_FILE, backup);
    openDb();
    throw e;
  }
}

const handlers: { [K in OpName]: (...args: Ops[K][0]) => Ops[K][1] | Promise<Ops[K][1]> } = {
  init,
  query: (sql, params) => db.query(sql, params),
  exec: (sql, params) => db.exec(sql, params),
  api: (name, args) => {
    if (!Object.hasOwn(api, name)) throw new Error(`Unknown api call: ${name}`);
    const fn = (api as Record<string, (db: SqlDb, ...a: unknown[]) => unknown>)[name];
    return fn(db, ...args);
  },
  exportSqlite: () => sqlite3.capi.sqlite3_js_db_export(raw),
  exportJson: () => dumpJson(db),
  importSqlite,
};

// Serialize requests so an import can't interleave with other work.
let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (ev: MessageEvent<Request>) => {
  const { id, op, args } = ev.data;
  queue = queue.then(async () => {
    let msg: Response;
    try {
      if (op !== 'init' && !raw) await init();
      const result = await (handlers[op] as (...a: unknown[]) => unknown)(...(args as unknown[]));
      msg = { id, ok: true, result };
    } catch (e) {
      msg = { id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    const transfer = msg.ok && msg.result instanceof Uint8Array ? [msg.result.buffer] : [];
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
  });
};
