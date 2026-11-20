/** Stored form of a link inside a description: `@[Label](id)`. Group 1 = label, group 2 = id. */
export const MENTION_RE = /@\[([^\]\n]*)\]\((\d+)\)/g;

/** Text with every `@[Label](id)` link replaced by its label. */
export const stripMentions = (text: string): string => text.replace(MENTION_RE, '$1');

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; id: number; label: string };

export function formatMention(label: string, id: number): string {
  const clean = label.replace(/[[\]]/g, '').replace(/\s*\n\s*/g, ' ').trim();
  return `@[${clean}](${id})`;
}

/** Unique target ids, in order of first appearance. */
export function parseMentionIds(text: string): number[] {
  const ids = new Set<number>();
  for (const m of text.matchAll(MENTION_RE)) ids.add(Number(m[2]));
  return [...ids];
}

export function tokenize(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push({ kind: 'mention', id: Number(m[2]), label: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export interface AtQuery {
  /** Index of the `@` in the text. */
  start: number;
  /** Lower-cased type key from an `@key:` prefix, if any. */
  typeKey: string | null;
  term: string;
}

const AT_QUERY_RE = /(?:^|[\s([{"'])@(?:([a-z0-9-]+):)?([^@\n[\]()]*)$/i;
const MAX_TERM = 40;

/** Given the text before the caret, returns the in-progress `@` query, or null if there isn't one. */
export function parseAtQuery(beforeCaret: string): AtQuery | null {
  const m = AT_QUERY_RE.exec(beforeCaret);
  if (!m) return null;
  const term = m[2];
  if (term.length > MAX_TERM || /^\s/.test(term)) return null;
  const start = m.index + (m[0].startsWith('@') ? 0 : 1);
  return { start, typeKey: m[1]?.toLowerCase() ?? null, term };
}
