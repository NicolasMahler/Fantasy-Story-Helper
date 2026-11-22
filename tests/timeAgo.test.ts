import { describe, it, expect } from 'vitest';
import { timeAgo } from '../src/lib/timeAgo';
import { backupOverdue } from '../src/db/meta';

const now = new Date('2026-11-19T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('timeAgo', () => {
  it('reads naturally', () => {
    expect(timeAgo(ago(10_000), now)).toBe('just now');
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe('3 days ago');
    expect(timeAgo(ago(1 * 86_400_000), now)).toBe('1 day ago');
  });

  it('rounds up into the next unit instead of saying "60 minutes"', () => {
    expect(timeAgo(ago(59.7 * 60_000), now)).toBe('1 hour ago');
    expect(timeAgo(ago(59.7 * 1000), now)).toBe('1 minute ago');
    expect(timeAgo(ago(23.8 * 3_600_000), now)).toBe('1 day ago');
  });
});

describe('backupOverdue', () => {
  it('nags only when there is data and no recent export', () => {
    expect(backupOverdue({ hasData: false, lastExportAt: null }, now)).toBe(false);
    expect(backupOverdue({ hasData: true, lastExportAt: null }, now)).toBe(true);
    expect(backupOverdue({ hasData: true, lastExportAt: ago(3 * 86_400_000) }, now)).toBe(false);
    expect(backupOverdue({ hasData: true, lastExportAt: ago(20 * 86_400_000) }, now)).toBe(true);
  });
});
