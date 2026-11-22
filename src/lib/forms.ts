/** Small helpers shared by form components. */
import type { Attributes } from '../db/entities';
import type { FieldDef } from '../db/entityTypes';

/**
 * Attributes to save from an entry form. Fields the type defines come from the draft: blank ones are
 * cleared, numbers are stored as numbers. Values of fields the type no longer defines are kept from
 * `previous` (pass null when the type changed, so they are dropped).
 */
export function mergeAttributes(fields: FieldDef[], draft: Record<string, unknown>, previous: Attributes | null): Attributes {
  const defined = new Set(fields.map((f) => f.key));
  const out: Attributes = {};
  for (const [k, v] of Object.entries(previous ?? {})) if (!defined.has(k)) out[k] = v;
  for (const f of fields) {
    const v = draft[f.key];
    if (v === undefined || v === null || v === '') continue;
    out[f.key] = f.kind === 'number' ? Number(v) : String(v);
  }
  return out;
}

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
