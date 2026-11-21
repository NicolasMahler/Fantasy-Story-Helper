import type { SqlDb } from './types';
import { insertId } from './sql';

/** On a theory, whether a quote backs it up or cuts against it. Other entries' quotes have no stance. */
export type Stance = 'for' | 'against';

export interface QuoteInput {
  /** The entry the quote is filed under. */
  entityId: number;
  text: string;
  bookId: number | null;
  /** Free text: "Ch. 12", "p. 340", "Prologue". */
  chapter: string;
  /** Who says it, if anyone in particular. */
  speakerId: number | null;
  note: string;
  /** Only kept when the entry is a theory. */
  stance: Stance | null;
}

interface Ref { id: number; name: string; icon: string; color: string }

export interface QuoteRow {
  id: number;
  text: string;
  chapter: string;
  note: string;
  stance: Stance | null;
  book: { id: number; number: number; title: string } | null;
  speaker: Ref | null;
  /** The entry it is filed under. */
  entry: Ref;
}

function entrySeries(db: SqlDb, id: number): { series_id: number; is_theory: number } {
  const [row] = db.query<{ series_id: number; is_theory: number }>(
    'SELECT series_id, EXISTS (SELECT 1 FROM theory WHERE entity_id = entity.id) AS is_theory FROM entity WHERE id = ?',
    [id],
  );
  if (!row) throw new Error('That entry does not exist.');
  return row;
}

/** Checks the input against the entry it is filed under and returns the values to store. */
function clean(db: SqlDb, entityId: number, input: Omit<QuoteInput, 'entityId'>) {
  const text = input.text.trim();
  if (!text) throw new Error('Type or paste the quote.');
  const { series_id: seriesId, is_theory } = entrySeries(db, entityId);
  if (input.bookId !== null && !db.query('SELECT 1 FROM book WHERE id = ? AND series_id = ?', [input.bookId, seriesId]).length) {
    throw new Error('That book does not belong to this series.');
  }
  if (input.speakerId !== null && !db.query('SELECT 1 FROM entity WHERE id = ? AND series_id = ?', [input.speakerId, seriesId]).length) {
    throw new Error('The speaker must be an entry in this series.');
  }
  if (input.stance !== null && input.stance !== 'for' && input.stance !== 'against') throw new Error('Unknown stance.');
  return {
    text,
    bookId: input.bookId,
    chapter: input.chapter.trim(),
    speakerId: input.speakerId,
    note: input.note.trim(),
    stance: is_theory ? input.stance : null,
  };
}

export function createQuote(db: SqlDb, input: QuoteInput): number {
  return db.transaction(() => {
    const q = clean(db, input.entityId, input);
    db.exec(
      `INSERT INTO quote (entity_id, text, book_id, chapter, speaker_entity_id, note, stance) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.entityId, q.text, q.bookId, q.chapter, q.speakerId, q.note, q.stance],
    );
    return insertId(db);
  });
}

export function updateQuote(db: SqlDb, id: number, input: Omit<QuoteInput, 'entityId'>): void {
  db.transaction(() => {
    const [row] = db.query<{ entity_id: number }>('SELECT entity_id FROM quote WHERE id = ?', [id]);
    if (!row) throw new Error('That quote no longer exists.');
    const q = clean(db, row.entity_id, input);
    db.exec(
      `UPDATE quote SET text = ?, book_id = ?, chapter = ?, speaker_entity_id = ?, note = ?, stance = ? WHERE id = ?`,
      [q.text, q.bookId, q.chapter, q.speakerId, q.note, q.stance, id],
    );
  });
}

export function deleteQuote(db: SqlDb, id: number): void {
  db.exec('DELETE FROM quote WHERE id = ?', [id]);
}

const SELECT = `
  SELECT q.id, q.text, q.chapter, q.note, q.stance,
         b.id AS b_id, b.number AS b_number, b.title AS b_title,
         s.id AS s_id, s.name AS s_name, st.icon AS s_icon, st.color AS s_color,
         e.id AS e_id, e.name AS e_name, et.icon AS e_icon, et.color AS e_color
  FROM quote q
  JOIN entity e ON e.id = q.entity_id JOIN entity_type et ON et.id = e.type_id
  LEFT JOIN book b ON b.id = q.book_id
  LEFT JOIN entity s ON s.id = q.speaker_entity_id LEFT JOIN entity_type st ON st.id = s.type_id`;

interface Raw {
  id: number; text: string; chapter: string; note: string; stance: Stance | null;
  b_id: number | null; b_number: number | null; b_title: string | null;
  s_id: number | null; s_name: string | null; s_icon: string | null; s_color: string | null;
  e_id: number; e_name: string; e_icon: string; e_color: string;
}

const chapterOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Reading order: by book (undated last), then chapter ("Ch. 2" before "Ch. 10"), then when added. */
function toRows(raw: Raw[]): QuoteRow[] {
  return raw
    .sort((x, y) =>
      (x.b_number ?? Infinity) - (y.b_number ?? Infinity) || chapterOrder.compare(x.chapter, y.chapter) || x.id - y.id)
    .map((r) => ({
      id: r.id,
      text: r.text,
      chapter: r.chapter,
      note: r.note,
      stance: r.stance,
      book: r.b_id ? { id: r.b_id, number: r.b_number!, title: r.b_title! } : null,
      speaker: r.s_id ? { id: r.s_id, name: r.s_name!, icon: r.s_icon!, color: r.s_color! } : null,
      entry: { id: r.e_id, name: r.e_name, icon: r.e_icon, color: r.e_color },
    }));
}

/** Quotes filed under an entry. */
export function listQuotes(db: SqlDb, entityId: number): QuoteRow[] {
  return toRows(db.query<Raw>(`${SELECT} WHERE q.entity_id = ?`, [entityId]));
}

/** Quotes an entry speaks that are filed under other entries. */
export function quotesBy(db: SqlDb, speakerId: number): QuoteRow[] {
  return toRows(db.query<Raw>(`${SELECT} WHERE q.speaker_entity_id = ? AND q.entity_id <> ?`, [speakerId, speakerId]));
}
