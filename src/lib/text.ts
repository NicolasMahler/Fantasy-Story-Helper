/** Pure text helpers, shared by the UI and the db layer. */

/** "1 event", "3 events", "2 entries" (pass `many` for irregular plurals). */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Lower-case URL/file-safe slug: accents removed, runs of other characters become "-". */
export function slugify(s: string, fallback = ''): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
