/** Pure metric functions for Today, Review and the Stats page (spec §5.9). */
import { addDays, format, startOfWeek } from 'date-fns';
import type { Action, Card, Goal, ID, ReviewLog, Video } from '../db/types';
import { DAY, dayStartPlus, startOfDay } from './dates';

/** Consecutive days with >=1 review, ending today (or yesterday if none yet today). */
export function reviewStreak(reviews: Pick<ReviewLog, 'reviewedAt'>[], now: number): number {
  const days = new Set(reviews.map((r) => startOfDay(r.reviewedAt)));
  let day = startOfDay(now);
  if (!days.has(day)) day = dayStartPlus(day, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = dayStartPlus(day, -1);
  }
  return streak;
}

/** Share of reviews not rated "again". Returns null when there are no reviews. */
export function retention(reviews: Pick<ReviewLog, 'rating'>[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.filter((r) => r.rating !== 'again').length / reviews.length;
}

/** Retention over the last `days` days (default 30), counting today. */
export function recentRetention(reviews: Pick<ReviewLog, 'rating' | 'reviewedAt'>[], now: number, days = 30): number | null {
  const since = dayStartPlus(now, -(days - 1));
  return retention(reviews.filter((r) => r.reviewedAt >= since && r.reviewedAt <= now));
}

/** The headline number: logged videos with at least one completed action ÷ logged videos. */
export function appliedRatio(
  videos: Pick<Video, 'id' | 'status'>[],
  actions: Pick<Action, 'videoId' | 'doneAt'>[],
): { applied: number; logged: number; ratio: number | null } {
  const logged = videos.filter((v) => v.status === 'logged');
  const done = new Set(actions.filter((a) => a.doneAt).map((a) => a.videoId));
  const applied = logged.filter((v) => done.has(v.id)).length;
  return { applied, logged: logged.length, ratio: logged.length ? applied / logged.length : null };
}

export interface WeekBucket {
  weekStart: number;
  label: string; // "3 Nov"
  count: number;
  current: boolean;
}

/** Videos logged per week (weeks start Monday), oldest first, the current week last. */
export function videosPerWeek(videos: Pick<Video, 'status' | 'loggedAt'>[], now: number, weeks = 8): WeekBucket[] {
  const thisWeek = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i).getTime();
    buckets.push({ weekStart: ws, label: format(ws, 'd MMM'), count: 0, current: i === 0 });
  }
  for (const v of videos) {
    if (v.status !== 'logged' || v.loggedAt === undefined) continue;
    const ws = startOfWeek(v.loggedAt, { weekStartsOn: 1 }).getTime();
    const b = buckets.find((x) => x.weekStart === ws);
    if (b) b.count++;
  }
  return buckets;
}

export interface DayBucket {
  day: number;
  label: string; // "Mon 24"
  count: number;
  today: boolean;
}

/** Review load for the next `days` days. Overdue cards fold into today. Suspended cards excluded. */
export function reviewForecast(cards: Pick<Card, 'due' | 'suspended'>[], now: number, days = 14): DayBucket[] {
  const today = startOfDay(now);
  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => {
    const day = dayStartPlus(today, i);
    return { day, label: format(day, 'EEE d'), count: 0, today: i === 0 };
  });
  for (const c of cards) {
    if (c.suspended) continue;
    const idx = Math.round((startOfDay(Math.max(c.due, today)) - today) / DAY);
    if (idx >= 0 && idx < days) buckets[idx].count++;
  }
  return buckets;
}

export interface GoalLapse {
  goalId: ID;
  title: string;
  reviews: number;
  lapses: number;
  rate: number;
}

/**
 * Weakest goals: share of reviews rated "again" for cards in each goal, highest first.
 * Goals with fewer than `minReviews` reviews are skipped (too little data to judge).
 */
export function goalLapseRates(
  cards: Pick<Card, 'id' | 'goalId'>[],
  reviews: Pick<ReviewLog, 'cardId' | 'rating'>[],
  goals: Pick<Goal, 'id' | 'title'>[],
  minReviews = 3,
): GoalLapse[] {
  const goalOfCard = new Map(cards.map((c) => [c.id, c.goalId]));
  const acc = new Map<ID, { reviews: number; lapses: number }>();
  for (const r of reviews) {
    const g = goalOfCard.get(r.cardId);
    if (!g) continue;
    const a = acc.get(g) ?? { reviews: 0, lapses: 0 };
    a.reviews++;
    if (r.rating === 'again') a.lapses++;
    acc.set(g, a);
  }
  return goals
    .map((g) => ({ goalId: g.id, title: g.title, ...(acc.get(g.id) ?? { reviews: 0, lapses: 0 }) }))
    .filter((g) => g.reviews >= minReviews)
    .map((g) => ({ ...g, rate: g.lapses / g.reviews }))
    .sort((a, b) => b.rate - a.rate || b.reviews - a.reviews);
}

/** Cards you forget most: lapses > 0, most lapses first, then lowest ease. */
export function weakSpots<T extends Pick<Card, 'lapses' | 'ease' | 'suspended'>>(cards: T[], n = 5): T[] {
  return cards
    .filter((c) => c.lapses > 0 && !c.suspended)
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, n);
}
