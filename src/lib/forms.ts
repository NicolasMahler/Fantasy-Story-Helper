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
