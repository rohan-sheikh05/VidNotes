import { describe, expect, it } from 'vitest';
import { newCardSchedule, previewIntervals, schedule, MIN_EASE, MAX_INTERVAL } from '../lib/scheduler';
import { dayStartPlus, startOfDay } from '../lib/dates';
import type { Card, Rating } from '../db/types';

const NOW = new Date(2026, 2, 10, 15, 37).getTime(); // mid-afternoon, local time

function makeCard(over: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    videoId: 'v1',
    cue: 'q',
    answer: 'a',
    ...newCardSchedule(NOW),
    createdAt: NOW,
    ...over,
  };
}

/** Apply a sequence of ratings, one review per due date. */
function run(ratings: Rating[], start = makeCard()) {
  let card = start;
  let t = NOW;
  const intervals: number[] = [];
  for (const r of ratings) {
    card = { ...card, ...schedule(card, r, t) };
    intervals.push(card.intervalDays);
    t = card.due + 10 * 3600_000; // review at 10:00 on the due day
  }
  return { card, intervals };
}

describe('newCardSchedule', () => {
  it('makes a new card due at the start of tomorrow', () => {
    const c = newCardSchedule(NOW);
    expect(c.due).toBe(dayStartPlus(NOW, 1));
    expect(c).toMatchObject({ intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, suspended: false });
  });
});

describe('schedule: first review', () => {
  it.each<[Rating, number]>([
    ['again', 1],
    ['hard', 1],
    ['good', 1],
    ['easy', 3],
  ])('%s → %i day(s)', (rating, days) => {
    const res = schedule(makeCard(), rating, NOW);
    expect(res.intervalDays).toBe(days);
    expect(res.due).toBe(dayStartPlus(NOW, days));
    expect(res.lastReviewedAt).toBe(NOW);
  });

  it('adjusts ease and counters', () => {
    expect(schedule(makeCard(), 'hard', NOW)).toMatchObject({ ease: 2.35, reps: 1, lapses: 0 });
    expect(schedule(makeCard(), 'easy', NOW)).toMatchObject({ ease: 2.65, reps: 1 });
    expect(schedule(makeCard(), 'good', NOW)).toMatchObject({ ease: 2.5, reps: 1 });
    expect(schedule(makeCard(), 'again', NOW)).toMatchObject({ ease: 2.3, reps: 0, lapses: 1 });
  });
});

describe('schedule: second review', () => {
  it.each<[Rating, number]>([
    ['hard', 2],
    ['good', 3],
    ['easy', 5],
  ])('%s → %i days', (rating, days) => {
    const card = makeCard({ reps: 1, intervalDays: 1 });
    expect(schedule(card, rating, NOW).intervalDays).toBe(days);
  });
});

describe('schedule: growth', () => {
  it('grows roughly 1 → 3 → 8 → 20 → 50 on repeated "good"', () => {
    const { intervals } = run(['good', 'good', 'good', 'good', 'good']);
    expect(intervals).toEqual([1, 3, 8, 20, 50]);
  });

  it('always grows by at least one day on non-again ratings', () => {
    const card = makeCard({ reps: 5, intervalDays: 2, ease: MIN_EASE });
    expect(schedule(card, 'hard', NOW).intervalDays).toBeGreaterThanOrEqual(3);
  });
});

describe('schedule: lapses', () => {
  it('"again" resets interval to 1, reps to 0, and lowers ease', () => {
    const card = makeCard({ reps: 4, intervalDays: 20, ease: 2.5, lapses: 0 });
    const res = schedule(card, 'again', NOW);
    expect(res).toMatchObject({ intervalDays: 1, reps: 0, lapses: 1, ease: 2.3 });
    expect(res.due).toBe(dayStartPlus(NOW, 1));
  });

  it('ease never drops below 1.3', () => {
    const { card } = run(Array(20).fill('again'));
    expect(card.ease).toBe(MIN_EASE);
    const { card: c2 } = run(Array(20).fill('hard'));
    expect(c2.ease).toBe(MIN_EASE);
  });
});

describe('schedule: limits', () => {
  it('caps the interval at 365 days', () => {
    const card = makeCard({ reps: 10, intervalDays: 300, ease: 3 });
    expect(schedule(card, 'easy', NOW).intervalDays).toBe(MAX_INTERVAL);
    const { card: c2 } = run(Array(30).fill('easy'));
    expect(c2.intervalDays).toBe(MAX_INTERVAL);
  });

  it('due always lands at the start of a day', () => {
    const times = [
      new Date(2026, 0, 1, 0, 0).getTime(),
      new Date(2026, 2, 28, 23, 59).getTime(), // around EU DST change
      new Date(2026, 10, 1, 12, 0).getTime(), // around US DST change
      NOW,
    ];
    for (const t of times) {
      for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) {
        for (const card of [makeCard(), makeCard({ reps: 3, intervalDays: 13 })]) {
          const due = schedule(card, r, t).due!;
          expect(due).toBe(startOfDay(due));
          expect(new Date(due).getHours()).toBe(0);
        }
      }
    }
  });
});

describe('previewIntervals', () => {
  it('matches what schedule() would produce', () => {
    const card = makeCard({ reps: 2, intervalDays: 3 });
    const p = previewIntervals(card);
    for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) {
      expect(p[r]).toBe(schedule(card, r, NOW).intervalDays);
    }
  });
});
