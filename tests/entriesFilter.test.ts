import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Minimal sessionStorage stand-in for node. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe('entries filter memory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('sessionStorage', fakeStorage());
  });

  it('starts empty and remembers each series separately', async () => {
    const { loadFilter, saveFilter, EMPTY_FILTER } = await import('../src/lib/entriesFilter');
    expect(loadFilter(1)).toEqual(EMPTY_FILTER);
    saveFilter(1, { typeId: 5, search: 'kel', theoryStatus: 'open' });
    expect(loadFilter(1)).toEqual({ typeId: 5, search: 'kel', theoryStatus: 'open' });
    expect(loadFilter(2)).toEqual(EMPTY_FILTER);
  });

  it('survives a reload of the page', async () => {
    (await import('../src/lib/entriesFilter')).saveFilter(3, { typeId: 2, search: '', theoryStatus: null });
    vi.resetModules();
    expect((await import('../src/lib/entriesFilter')).loadFilter(3)).toMatchObject({ typeId: 2 });
  });

  it('copes with storage that is broken or unavailable', async () => {
    vi.stubGlobal('sessionStorage', { ...fakeStorage(), getItem: () => '{not json', setItem: () => { throw new Error('full'); } });
    const { loadFilter, saveFilter, EMPTY_FILTER } = await import('../src/lib/entriesFilter');
    expect(loadFilter(1)).toEqual(EMPTY_FILTER);
    saveFilter(1, { typeId: 9, search: '', theoryStatus: null });
    expect(loadFilter(1).typeId).toBe(9);
  });
});
