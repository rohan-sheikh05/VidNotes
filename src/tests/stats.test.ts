import { describe, expect, it } from 'vitest';
import {
  appliedRatio,
  goalLapseRates,
  recentRetention,
  retention,
  reviewForecast,
  reviewStreak,
  videosPerWeek,
  weakSpots,
} from '../lib/stats';
import { dayStartPlus, startOfDay } from '../lib/dates';

const at = (d: number, h = 12) => new Date(2026, 4, d, h).getTime(); // May 2026; 4 May is a Monday

describe('reviewStreak', () => {
  it('counts consecutive days ending today', () => {
    const reviews = [at(8), at(9), at(10, 9), at(10, 20)].map((reviewedAt) => ({ reviewedAt }));
    expect(reviewStreak(reviews, at(10, 22))).toBe(3);
  });

  it('still counts a streak ending yesterday (today not done yet)', () => {
    const reviews = [at(8), at(9)].map((reviewedAt) => ({ reviewedAt }));
    expect(reviewStreak(reviews, at(10))).toBe(2);
  });

  it('is 0 after a missed day', () => {
    expect(reviewStreak([{ reviewedAt: at(7) }], at(10))).toBe(0);
    expect(reviewStreak([], at(10))).toBe(0);
  });
});

describe('retention', () => {
  it('is the share of non-again ratings', () => {
    expect(retention([{ rating: 'good' }, { rating: 'again' }, { rating: 'easy' }, { rating: 'hard' }])).toBe(0.75);
    expect(retention([])).toBeNull();
  });

  it('recentRetention only counts the last 30 days', () => {
    const now = at(31);
    const reviews = [
      { rating: 'again' as const, reviewedAt: dayStartPlus(now, -40) }, // too old
      { rating: 'good' as const, reviewedAt: dayStartPlus(now, -29) }, // first day of the window
      { rating: 'again' as const, reviewedAt: at(30) },
    ];
    expect(recentRetention(reviews, now)).toBe(0.5);
    expect(recentRetention([], now)).toBeNull();
  });
});

describe('appliedRatio', () => {
  it('counts logged videos with at least one completed action', () => {
    const videos = [
      { id: 'a', status: 'logged' as const },
      { id: 'b', status: 'logged' as const },
      { id: 'c', status: 'logged' as const },
      { id: 'd', status: 'watching' as const },
    ];
    const actions = [
      { videoId: 'a', doneAt: 1 },
      { videoId: 'a', doneAt: 2 }, // two done actions still count once
      { videoId: 'b' }, // open
      { videoId: 'd', doneAt: 3 }, // not logged: ignored
    ];
    expect(appliedRatio(videos, actions)).toEqual({ applied: 1, logged: 3, ratio: 1 / 3 });
  });

  it('is null with nothing logged', () => {
    expect(appliedRatio([], []).ratio).toBeNull();
  });
});

describe('videosPerWeek', () => {
  it('buckets logged videos into Monday-start weeks, current week last', () => {
    const now = at(13); // Wednesday 13 May
    const weeks = videosPerWeek(
      [
        { status: 'logged', loggedAt: at(11, 8) }, // Mon this week
        { status: 'logged', loggedAt: at(10, 23) }, // Sun → previous week
        { status: 'logged', loggedAt: at(4) }, // Mon previous week
        { status: 'watching', loggedAt: undefined },
        { status: 'logged', loggedAt: at(1, 1) - 60 * 86_400_000 }, // outside the window
      ],
      now,
      3,
    );
    expect(weeks.map((w) => [w.label, w.count, w.current])).toEqual([
      ['27 Apr', 0, false],
      ['4 May', 2, false],
      ['11 May', 1, true],
    ]);
  });
});

describe('reviewForecast', () => {
  it('folds overdue into today, skips suspended, ignores beyond the window', () => {
    const now = at(10, 15);
    const today = startOfDay(now);
    const f = reviewForecast(
      [
        { due: dayStartPlus(today, -3), suspended: false }, // overdue → today
        { due: today, suspended: false },
        { due: dayStartPlus(today, 1), suspended: false },
        { due: dayStartPlus(today, 1), suspended: true },
        { due: dayStartPlus(today, 13), suspended: false }, // last day
        { due: dayStartPlus(today, 14), suspended: false }, // outside
      ],
      now,
    );
    expect(f).toHaveLength(14);
    expect(f[0]).toMatchObject({ count: 2, today: true });
    expect(f[1].count).toBe(1);
    expect(f[13].count).toBe(1);
    expect(f.reduce((s, d) => s + d.count, 0)).toBe(4);
  });
});

describe('goalLapseRates', () => {
  it('ranks goals by share of "again" reviews and skips thin data', () => {
    const cards = [
      { id: 'c1', goalId: 'g1' },
      { id: 'c2', goalId: 'g2' },
      { id: 'c3', goalId: 'g3' },
      { id: 'c4', goalId: undefined },
    ];
    const r = (cardId: string, rating: 'again' | 'good') => ({ cardId, rating });
    const reviews = [
      r('c1', 'again'), r('c1', 'good'), r('c1', 'good'), r('c1', 'good'), // g1: 25%
      r('c2', 'again'), r('c2', 'again'), r('c2', 'good'), // g2: 67%
      r('c3', 'again'), // g3: too few reviews
      r('c4', 'again'), r('c4', 'again'), r('c4', 'again'), // no goal
    ];
    const goals = [
      { id: 'g1', title: 'Python' },
      { id: 'g2', title: 'Speaking' },
      { id: 'g3', title: 'Chess' },
    ];
    const out = goalLapseRates(cards, reviews, goals);
    expect(out.map((g) => [g.title, g.reviews, g.lapses])).toEqual([
      ['Speaking', 3, 2],
      ['Python', 4, 1],
    ]);
    expect(out[1].rate).toBe(0.25);
  });
});

describe('weakSpots', () => {
  it('lists cards with lapses, most first, then lowest ease; skips suspended', () => {
    const c = (id: string, lapses: number, ease: number, suspended = false) => ({ id, lapses, ease, suspended });
    const out = weakSpots([c('a', 0, 2.5), c('b', 2, 2.1), c('c', 3, 2.0), c('d', 2, 1.6), c('e', 5, 1.3, true)], 3);
    expect(out.map((x) => x.id)).toEqual(['c', 'd', 'b']);
  });
});
