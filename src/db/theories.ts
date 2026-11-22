import type { SqlDb } from './types';
import { bookRef, type BookRef } from './books';
import { bookInSeries, extensionSeries } from './sql';

/** A theory is a guess that turns out confirmed or wrong; a question is open until it's answered. */
export type TheoryKind = 'theory' | 'question';
export type TheoryStatus = 'open' | 'confirmed' | 'wrong' | 'answered';

/** The statuses each kind can have, in the order the form offers them. */
export const STATUSES: Record<TheoryKind, TheoryStatus[]> = {
  theory: ['open', 'confirmed', 'wrong'],
  question: ['open', 'answered'],
};

export const STATUS_LABELS: Record<TheoryStatus, string> = {
  open: 'Open',
  confirmed: 'Confirmed',
  wrong: 'Wrong',
  answered: 'Answered',
};

export interface TheoryInput {
  kind: TheoryKind;
  status: TheoryStatus;
  /** Where it was settled. Ignored (cleared) while open. */
  resolvedBookId: number | null;
  /** How it was settled. Ignored (cleared) while open. */
  resolution: string;
}

export interface TheoryDetail {
  entityId: number;
  kind: TheoryKind;
  status: TheoryStatus;
  resolvedBook: BookRef | null;
  resolution: string;
}

/**
 * When the kind changes, carries the status over where it means the same: a confirmed theory becomes an
 * answered question and back. A wrong theory has no question equivalent and becomes open.
 */
export function statusForKind(kind: TheoryKind, status: TheoryStatus): TheoryStatus {
  if (STATUSES[kind].includes(status)) return status;
  if (kind === 'question') return status === 'confirmed' ? 'answered' : 'open';
  return status === 'answered' ? 'confirmed' : 'open';
}

function theorySeries(db: SqlDb, id: number): number {
  const s = extensionSeries(db, 'theory', id);
  if (s === undefined) throw new Error('That entry is not a theory.');
  return s;
}

export function saveTheory(db: SqlDb, id: number, input: TheoryInput): void {
  db.transaction(() => {
    const seriesId = theorySeries(db, id);
    if (input.kind !== 'theory' && input.kind !== 'question') throw new Error('Unknown kind.');
    if (!STATUSES[input.kind].includes(input.status)) {
      throw new Error(input.kind === 'question' ? 'A question is either open or answered.' : 'A theory is open, confirmed or wrong.');
    }
    const open = input.status === 'open';
    const bookId = bookInSeries(db, seriesId, open ? null : input.resolvedBookId);
    const resolution = open ? '' : input.resolution.trim();
    db.exec('UPDATE theory SET kind = ?, status = ?, resolved_book_id = ?, resolution = ? WHERE entity_id = ?', [
      input.kind, input.status, bookId, resolution, id,
    ]);
    db.exec(`UPDATE entity SET updated_at = datetime('now') WHERE id = ?`, [id]);
  });
}

export function getTheoryDetail(db: SqlDb, id: number): TheoryDetail | null {
  const [r] = db.query<{
    kind: TheoryKind; status: TheoryStatus; resolved_book_id: number | null; resolution: string;
    b_number: number | null; b_title: string | null;
  }>(
    `SELECT th.kind, th.status, th.resolved_book_id, th.resolution, b.number AS b_number, b.title AS b_title
     FROM theory th LEFT JOIN book b ON b.id = th.resolved_book_id WHERE th.entity_id = ?`,
    [id],
  );
  if (!r) return null;
  return {
    entityId: id,
    kind: r.kind,
    status: r.status,
    resolvedBook: bookRef(r.resolved_book_id, r.b_number, r.b_title),
    resolution: r.resolution,
  };
}
