import type { JsonDump } from './dump';
import type { ImportMode, ImportResult } from './transfer';

/** Where the data actually lives this session. */
export type StorageMode =
  | 'opfs'     // persistent on-device file (normal)
  | 'locked'   // another tab holds the database; this tab runs in memory
  | 'memory';  // browser can't persist (no OPFS); this tab runs in memory

export interface InitInfo {
  storage: StorageMode;
  schemaVersion: number;
  sqliteVersion: string;
}

/** Worker operations: name → [args, result]. */
export interface Ops {
  init: [[], InitInfo];
  query: [[sql: string, params?: unknown[]], Record<string, unknown>[]];
  exec: [[sql: string, params?: unknown[]], void];
  api: [[name: string, args: unknown[]], unknown];
  exportSqlite: [[], Uint8Array];
  /** Whole database, or one series when an id is given. */
  exportJson: [[seriesId?: number], JsonDump];
  importJson: [[raw: unknown, mode: ImportMode], ImportResult];
  importSqlite: [[bytes: Uint8Array], InitInfo];
}
export type OpName = keyof Ops;

export interface Request<K extends OpName = OpName> {
  id: number;
  op: K;
  args: Ops[K][0];
}
export type Response =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
