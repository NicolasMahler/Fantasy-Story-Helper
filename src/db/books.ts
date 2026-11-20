import type { SqlDb } from './types';
import { insertId } from './sql';

export interface BookRow {
  id: number;
  number: number;
  title: string;
  /** Entries whose first appearance is this book. */
  entities: number;
  /** Events that occur or are described in this book. */
  events: number;
}

export function listBooks(db: SqlDb, seriesId: number): BookRow[] {
  return db.query<BookRow>(
    `SELECT b.id, b.number, b.title,
            (SELECT COUNT(*) FROM entity e WHERE e.first_book_id = b.id) AS entities,
            (SELECT COUNT(*) FROM event ev WHERE ev.book_id = b.id)      AS events
     FROM book b WHERE b.series_id = ? ORDER BY b.number`,
    [seriesId],
  );
}

function cleanTitle(title: string): string {
  const t = title.trim();
  if (!t) throw new Error('Book title is required.');
  return t;
}

/** Appends a book after the last one. Returns its id. */
export function addBook(db: SqlDb, seriesId: number, title: string): number {
  const t = cleanTitle(title);
  return db.transaction(() => {
    db.exec(
      `INSERT INTO book (series_id, number, title)
       VALUES (?, (SELECT COALESCE(MAX(number), 0) + 1 FROM book WHERE series_id = ?), ?)`,
      [seriesId, seriesId, t],
    );
    return insertId(db);
  });
}

export function updateBook(db: SqlDb, id: number, title: string): void {
  db.exec('UPDATE book SET title = ? WHERE id = ?', [cleanTitle(title), id]);
}

/** Swaps the book with its neighbour (-1 = earlier, +1 = later). No-op at either end. */
export function moveBook(db: SqlDb, id: number, direction: -1 | 1): void {
  db.transaction(() => {
    const [book] = db.query<{ series_id: number; number: number }>('SELECT series_id, number FROM book WHERE id = ?', [id]);
    if (!book) return;
    const [other] = db.query<{ id: number }>('SELECT id FROM book WHERE series_id = ? AND number = ?', [
      book.series_id, book.number + direction,
    ]);
    if (!other) return;
    db.exec('UPDATE book SET number = -1 WHERE id = ?', [id]);
    db.exec('UPDATE book SET number = ? WHERE id = ?', [book.number, other.id]);
    db.exec('UPDATE book SET number = ? WHERE id = ?', [book.number + direction, id]);
  });
}

/** Deletes a book and renumbers the later ones so numbering stays 1..n. */
export function deleteBook(db: SqlDb, id: number): void {
  db.transaction(() => {
    const [book] = db.query<{ series_id: number; number: number }>('SELECT series_id, number FROM book WHERE id = ?', [id]);
    if (!book) return;
    db.exec('DELETE FROM book WHERE id = ?', [id]);
    // Two passes via negatives so UNIQUE(series_id, number) never collides mid-update.
    db.exec('UPDATE book SET number = -number WHERE series_id = ? AND number > ?', [book.series_id, book.number]);
    db.exec('UPDATE book SET number = -number - 1 WHERE series_id = ? AND number < 0', [book.series_id]);
  });
}
