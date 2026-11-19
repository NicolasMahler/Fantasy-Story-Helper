import type { SqlDb } from './types';

export function getMeta(db: SqlDb, key: string): string | null {
  return db.query<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key])[0]?.value ?? null;
}

export function setMeta(db: SqlDb, key: string, value: string): void {
  db.exec('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export interface BackupStatus {
  /** ISO time of the last export, or null if never. */
  lastExportAt: string | null;
  /** Whether there is anything worth backing up. */
  hasData: boolean;
}

export function recordExport(db: SqlDb, at = new Date()): void {
  setMeta(db, 'last_export_at', at.toISOString());
}

export function backupStatus(db: SqlDb): BackupStatus {
  return {
    lastExportAt: getMeta(db, 'last_export_at'),
    hasData: db.query('SELECT 1 FROM series LIMIT 1').length > 0,
  };
}

/** True when there is data and no export in `days` days (or never). */
export function backupOverdue(s: BackupStatus, now = new Date(), days = 14): boolean {
  if (!s.hasData) return false;
  if (!s.lastExportAt) return true;
  return now.getTime() - Date.parse(s.lastExportAt) > days * 86_400_000;
}
