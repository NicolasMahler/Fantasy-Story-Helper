/** Text matching shared by the entries list and global search: excerpts around a match, alias lookups. */
import { stripMentions } from './mentions';

export interface Snippet {
  text: string;
  /** Where the match starts in `text` (for highlighting). */
  start: number;
  length: number;
}

/** How much text to show around a match, in characters. */
export interface Around {
  before: number;
  after: number;
}

const plainText = (text: string) => stripMentions(text).replace(/\s+/g, ' ').trim();

/**
 * Excerpt around the first match of `q` in the text people see (`@` links shown as their names), starting
 * and ending on word boundaries where there is one nearby. Null when the visible text doesn't contain `q`.
 */
export function findSnippet(text: string, q: string, { before, after }: Around = { before: 40, after: 70 }): Snippet | null {
  const plain = plainText(text);
  const i = plain.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return null;
  let from = Math.max(0, i - before);
  if (from > 0) {
    const space = plain.indexOf(' ', from);
    if (space >= 0 && space < i) from = space + 1;
  }
  let to = Math.min(plain.length, i + q.length + after);
  if (to < plain.length) {
    const space = plain.lastIndexOf(' ', to);
    if (space > i + q.length) to = space;
  }
  const prefix = from > 0 ? '…' : '';
  return { text: `${prefix}${plain.slice(from, to)}${to < plain.length ? '…' : ''}`, start: i - from + prefix.length, length: q.length };
}

/** Like findSnippet, but without a match shows the start of the text (nothing highlighted). */
export function makeSnippet(text: string, q: string, around?: Around): Snippet {
  const found = findSnippet(text, q, around);
  if (found) return found;
  const plain = plainText(text);
  const max = (around?.before ?? 40) + (around?.after ?? 70);
  return { text: plain.length > max ? `${plain.slice(0, max)}…` : plain, start: 0, length: 0 };
}

/** The first alias (from the stored JSON array) containing `term`, ignoring case. */
export function aliasMatch(aliasesJson: string, term: string): string | undefined {
  const t = term.toLowerCase();
  return (JSON.parse(aliasesJson) as string[]).find((a) => a.toLowerCase().includes(t));
}
