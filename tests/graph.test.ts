import { describe, it, expect } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity } from '../src/db/entities';
import { addParticipant } from '../src/db/events';
import { createLink } from '../src/db/links';
import { getGraph } from '../src/db/graph';

describe('getGraph', () => {
  it('returns nodes with type styling, types in order, events with participants, and links', () => {
    const { db, seriesId, typeId } = setup();
    const kalam = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Kalam' });
    const ben = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Quick Ben' });
    const siege = createEntity(db, { seriesId, typeId: typeId('event'), name: 'Siege' });
    addParticipant(db, siege, kalam);
    addParticipant(db, siege, ben);
    createLink(db, { fromId: kalam, toId: ben, kind: 'partners' });

    const g = getGraph(db, seriesId);
    expect(g.types.slice(0, 3).map((t) => t.key)).toEqual(['character', 'location', 'event']);
    expect(g.nodes.find((n) => n.id === kalam)).toMatchObject({ name: 'Kalam', typeKey: 'character', icon: expect.any(String) });
    expect(g.events).toHaveLength(1);
    expect(g.events[0].participants.map((p) => p.entityId).sort()).toEqual([kalam, ben].sort());
    expect(g.links).toEqual([{ id: expect.any(Number), from: kalam, to: ben, kind: 'partners' }]);
  });
});
