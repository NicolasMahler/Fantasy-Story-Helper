import { STATUS_LABELS, type TheoryDetail } from '../db/theories';

/** One line saying where a theory or question stands, e.g. "Confirmed in Book 2" or "Open question". */
export function statusLine(t: Pick<TheoryDetail, 'kind' | 'status' | 'resolvedBook'>): string {
  if (t.status === 'open') return t.kind === 'question' ? 'Open question' : 'Open theory';
  const label = STATUS_LABELS[t.status];
  return t.resolvedBook ? `${label} in Book ${t.resolvedBook.number}` : label;
}
