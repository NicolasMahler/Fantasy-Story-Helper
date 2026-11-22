import { plural } from './text';

/** "just now", "5 minutes ago", "3 days ago", "2 months ago". */
export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  const units: [number, string][] = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  if (s < 45) return 'just now';
  let v = s;
  for (const [size, name] of units) {
    const n = Math.round(v);
    // 59.7 minutes rounds to 60: say "1 hour" instead.
    if (n < size) return `${plural(n, name)} ago`;
    v /= size;
  }
  return 'a long time ago';
}
