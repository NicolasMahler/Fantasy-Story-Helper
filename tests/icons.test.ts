import { describe, it, expect } from 'vitest';
import { ICONS, PICKER_ICONS } from '../src/lib/icons';
import { DEFAULT_ENTITY_TYPES } from '../src/db/seed';

// The bundled icons come from a literal glob in icons.ts, so the names are listed twice; these keep the lists in step.
describe('icons', () => {
  it('bundles every icon the type picker offers', () => {
    expect(PICKER_ICONS.filter((n) => !(n in ICONS))).toEqual([]);
  });

  it('bundles and offers every built-in type icon', () => {
    for (const t of DEFAULT_ENTITY_TYPES) {
      expect(ICONS[t.icon], t.icon).toBeTruthy();
      expect(PICKER_ICONS).toContain(t.icon);
    }
  });

  it('offers each icon once', () => {
    expect(new Set(PICKER_ICONS).size).toBe(PICKER_ICONS.length);
  });
});
