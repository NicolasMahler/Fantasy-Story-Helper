/** Minimal synchronous SQL interface shared by the sqlite-wasm worker and node:sqlite tests. */
export interface SqlDb {
  exec(sql: string, params?: unknown[]): void;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  transaction<T>(fn: () => T): T;
}
