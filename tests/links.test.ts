import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity, deleteEntity } from '../src/db/entities';
import { createSeries } from '../src/db/seed';
import { createLink, deleteLink, listLinks } from '../src/db/links';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
let typeId: (k: string) => number;
let kalam: number;
let ben: number;
let claw: number;
beforeEach(() => {
  ({ db, seriesId, typeId } = setup());
  kalam = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Kalam' });
  ben = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Quick Ben' });
  claw = createEntity(db, { seriesId, typeId: typeId('faction'), name: 'Claw' });
});

describe('relationships', () => {
  it('creates and lists links from both sides with direction', () => {
    const siege = createEntity(db, { seriesId, typeId: typeId('event'), name: 'Siege' });
    createLink(db, { fromId: kalam, toId: ben, kind: ' partners ' });
    createLink(db, { fromId: kalam, toId: claw, kind: 'member of', note: 'former', endEventId: siege });
    expect(listLinks(db, kalam).map((l) => [l.kind, l.direction, l.other.name, l.note, l.endEvent?.name ?? null])).toEqual([
      ['member of', 'out', 'Claw', 'former', 'Siege'],
      ['partners', 'out', 'Quick Ben', '', null],
    ]);
    expect(listLinks(db, ben).map((l) => [l.kind, l.direction, l.other.name])).toEqual([['partners', 'in', 'Kalam']]);
  });

  it('validates kind, self-links, duplicates, series and event ends', () => {
    expect(() => createLink(db, { fromId: kalam, toId: ben, kind: '  ' })).toThrow(/kind/i);
    expect(() => createLink(db, { fromId: kalam, toId: kalam, kind: 'ally' })).toThrow(/itself/i);
    createLink(db, { fromId: kalam, toId: ben, kind: 'ally' });
    expect(() => createLink(db, { fromId: kalam, toId: ben, kind: 'Ally' })).toThrow(/already/i);
    const other = createSeries(db, { name: 'Other' });
    const otherType = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'item'`, [other])[0].id;
    const foreign = createEntity(db, { seriesId: other, typeId: otherType, name: 'F' });
    expect(() => createLink(db, { fromId: kalam, toId: foreign, kind: 'owns' })).toThrow(/series/i);
    expect(() => createLink(db, { fromId: kalam, toId: claw, kind: 'member of', startEventId: ben })).toThrow(/event/i);
  });

  it('deletes links, and links vanish with their entries', () => {
    const id = createLink(db, { fromId: kalam, toId: ben, kind: 'ally' });
    createLink(db, { fromId: kalam, toId: claw, kind: 'member of' });
    deleteLink(db, id);
    expect(listLinks(db, ben)).toEqual([]);
    deleteEntity(db, claw);
    expect(listLinks(db, kalam)).toEqual([]);
  });
});
