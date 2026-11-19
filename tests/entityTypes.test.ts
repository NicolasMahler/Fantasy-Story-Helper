import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { listTypes, createType, updateType, deleteType, slugify } from '../src/db/entityTypes';
import { createEntity } from '../src/db/entities';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
let typeId: (k: string) => number;
beforeEach(() => ({ db, seriesId, typeId } = setup()));

describe('entity types', () => {
  it('slugifies names into @-prefix keys', () => {
    expect(slugify('Noble House')).toBe('noble-house');
    expect(slugify('  Ünïcode Ships! ')).toBe('unicode-ships');
    expect(slugify('***')).toBe('type');
  });

  it('lists defaults in order with fields parsed and usage counts', () => {
    const types = listTypes(db, seriesId);
    expect(types.map((t) => t.key).slice(0, 3)).toEqual(['character', 'location', 'event']);
    expect(types[0]).toMatchObject({ fields: [], usage: 0, is_builtin: 0 });
  });

  it('creates a custom type with a unique key and fields, appended last', () => {
    const a = createType(db, seriesId, { name: 'Ship', icon: '⛵', color: '#123456', fields: [{ key: 'crew', label: 'Crew', kind: 'number' }] });
    const b = createType(db, seriesId, { name: 'ship', icon: '', color: '#000000', fields: [] });
    const types = listTypes(db, seriesId);
    expect(types.at(-2)).toMatchObject({ id: a, key: 'ship', name: 'Ship', fields: [{ key: 'crew', label: 'Crew', kind: 'number' }] });
    expect(types.at(-1)).toMatchObject({ id: b, key: 'ship-2' });
  });

  it('rejects a blank name and duplicate field keys', () => {
    expect(() => createType(db, seriesId, { name: ' ', icon: '', color: '#000000', fields: [] })).toThrow(/name/i);
    expect(() =>
      createType(db, seriesId, {
        name: 'X', icon: '', color: '#000000',
        fields: [{ key: 'a', label: 'A', kind: 'text' }, { key: 'a', label: 'A2', kind: 'text' }],
      }),
    ).toThrow(/field/i);
  });

  it('updates name/icon/color/fields but keeps the key', () => {
    const id = createType(db, seriesId, { name: 'Ship', icon: '', color: '#000000', fields: [] });
    updateType(db, id, { name: 'Vessel', icon: '🚢', color: '#ffffff', fields: [{ key: 'flag', label: 'Flag', kind: 'text' }] });
    expect(listTypes(db, seriesId).at(-1)).toMatchObject({ key: 'ship', name: 'Vessel', icon: '🚢' });
  });

  it('refuses to delete the builtin event type or a type in use', () => {
    expect(() => deleteType(db, typeId('event'))).toThrow(/built-in/i);
    createEntity(db, { seriesId, typeId: typeId('item'), name: 'Sword' });
    expect(() => deleteType(db, typeId('item'))).toThrow(/in use/i);
    deleteType(db, typeId('lore'));
    expect(listTypes(db, seriesId).some((t) => t.key === 'lore')).toBe(false);
  });
});
