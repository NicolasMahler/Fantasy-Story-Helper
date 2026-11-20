/** Small helpers shared by form components. */

/**
 * Value of a number input as a number, or null when blank.
 * Svelte binds `type="number"` inputs as `number | null`, but drafts may also start out as strings.
 */
export function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  return v.trim() === '' ? null : Number(v);
}

/**
 * Keyboard handling shared by the autocomplete listboxes. Given a key, the highlighted index and
 * the option count, returns the new index (ArrowUp/Down, wrapping), 'pick' (Enter, or Tab when
 * `pickOnTab`), 'close' (Escape), or null when the key isn't handled. With no options only
 * Escape is handled.
 */
export function listKey(
  key: string,
  active: number,
  count: number,
  { pickOnTab = false }: { pickOnTab?: boolean } = {},
): number | 'pick' | 'close' | null {
  if (key === 'Escape') return 'close';
  if (count === 0) return null;
  if (key === 'ArrowDown') return (active + 1) % count;
  if (key === 'ArrowUp') return (active - 1 + count) % count;
  if (key === 'Enter' || (pickOnTab && key === 'Tab')) return 'pick';
  return null;
}

/** Runs an async action, reporting any error message through `onError` instead of rejecting. */
export async function attempt(fn: () => Promise<unknown>, onError: (message: string) => void): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e));
    return false;
  }
}
