import { addDays, startOfDay as sod, format } from 'date-fns';

export const DAY = 86_400_000;

/** Local midnight of the day containing `ms`. */
export function startOfDay(ms: number): number {
  return sod(ms).getTime();
}

/** Local midnight `days` days after the day containing `ms` (DST-safe). */
export function dayStartPlus(ms: number, days: number): number {
  return addDays(sod(ms), days).getTime();
}

// Debug "time travel": the app's notion of "now" can be shifted by whole days.
let offsetDays = 0;
export function setTimeOffsetDays(days: number) {
  offsetDays = Number.isFinite(days) ? days : 0;
}
export function now(): number {
  return Date.now() + offsetDays * DAY;
}
export function today(): number {
  return startOfDay(now());
}

export function formatDate(ms: number): string {
  return format(ms, 'EEE, d MMM');
}

export function toDateInput(ms: number): string {
  return format(ms, 'yyyy-MM-dd');
}

export function fromDateInput(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** "today", "tomorrow", "3 days ago", ... relative to the app's now(). */
export function relativeDay(ms: number, ref: number = now()): string {
  const diff = Math.round((startOfDay(ms) - startOfDay(ref)) / DAY);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff < 0) return `${-diff} days ago`;
  return `in ${diff} days`;
}

export function formatInterval(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}
