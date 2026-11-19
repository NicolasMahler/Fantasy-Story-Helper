import type { Ops, OpName, Request, Response, InitInfo } from './protocol';
import type { ApiName, ApiArgs, ApiResult } from './api';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nextId = 1;

worker.onmessage = (ev: MessageEvent<Response>) => {
  const msg = ev.data;
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.ok) p.resolve(msg.result);
  else p.reject(new Error(msg.error));
};

function call<K extends OpName>(op: K, ...args: Ops[K][0]): Promise<Ops[K][1]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    const req: Request<K> = { id, op, args };
    const transfer = (args as unknown[])
      .filter((a): a is Uint8Array => a instanceof Uint8Array)
      .map((a) => a.buffer as ArrayBuffer);
    worker.postMessage(req, transfer);
  });
}

export interface StartupInfo extends InitInfo {
  /** Whether the browser agreed not to evict our storage. */
  persisted: boolean;
}

export const db = {
  async init(): Promise<StartupInfo> {
    const [info, persisted] = await Promise.all([call('init'), requestPersistence()]);
    return { ...info, persisted };
  },
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
    call('query', sql, params) as Promise<T[]>,
  exec: (sql: string, params?: unknown[]) => call('exec', sql, params),
  exportSqlite: () => call('exportSqlite'),
  exportJson: (seriesId?: number) => (seriesId === undefined ? call('exportJson') : call('exportJson', seriesId)),
  importJson: (raw: unknown, mode: 'replace' | 'add') => call('importJson', raw, mode),
  importSqlite: (bytes: Uint8Array) => call('importSqlite', bytes),
};

async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** Typed call to any domain function in src/db/api.ts, run inside the worker. */
export function rpc<K extends ApiName>(name: K, ...args: ApiArgs<K>): Promise<ApiResult<K>> {
  return call('api', name, args as unknown[]) as Promise<ApiResult<K>>;
}
