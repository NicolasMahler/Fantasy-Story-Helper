/**
 * The Entries tab's filter (type, search, theory status), remembered per series so that opening an
 * entry and coming back keeps it. Kept for the browser tab's session, so a reload keeps it too.
 */
import type { TheoryStatus } from '../db/theories';

export interface EntriesFilter {
  typeId: number | null;
  search: string;
  theoryStatus: TheoryStatus | null;
}

const KEY = 'fh.entriesFilter';
export const EMPTY_FILTER: EntriesFilter = { typeId: null, search: '', theoryStatus: null };

function read(): Record<string, EntriesFilter> {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

const remembered: Record<string, EntriesFilter> = read();

export function loadFilter(seriesId: number): EntriesFilter {
  return { ...EMPTY_FILTER, ...remembered[seriesId] };
}

export function saveFilter(seriesId: number, f: EntriesFilter): void {
  remembered[seriesId] = { typeId: f.typeId, search: f.search, theoryStatus: f.theoryStatus };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(remembered));
  } catch { /* storage unavailable: still remembered until the page reloads */ }
}
