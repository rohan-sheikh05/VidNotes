import type { Card, Rating } from '../db/types';
import { dayStartPlus } from './dates';

export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy'];
export const MAX_INTERVAL = 365;
export const MIN_EASE = 1.3;
export const START_EASE = 2.5;

type SchedState = Pick<Card, 'intervalDays' | 'ease' | 'reps' | 'lapses'>;

function nextState(card: SchedState, rating: Rating): SchedState {
  let { intervalDays, ease, reps, lapses } = card;

  if (rating === 'again') {
    lapses += 1;
    reps = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    intervalDays = 1;
  } else {
    if (reps === 0) {
      intervalDays = rating === 'easy' ? 3 : 1;
    } else if (reps === 1) {
      intervalDays = rating === 'hard' ? 2 : rating === 'easy' ? 5 : 3;
    } else {
      const mult = rating === 'hard' ? 1.2 : rating === 'easy' ? ease * 1.3 : ease;
      intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * mult));
    }
    if (rating === 'hard') ease = Math.max(MIN_EASE, ease - 0.15);
    if (rating === 'easy') ease = ease + 0.15;
    reps += 1;
  }

  intervalDays = Math.min(intervalDays, MAX_INTERVAL);
  // Round to avoid float drift (2.5 - 0.2 - 0.2 ...) accumulating over many reviews.
  return { intervalDays, ease: Math.round(ease * 100) / 100, reps, lapses };
}

/** Simplified SM-2. Pure: returns the fields to update on the card. */
export function schedule(card: Card, rating: Rating, now: number): Partial<Card> {
  const s = nextState(card, rating);
  return {
    ...s,
    lastReviewedAt: now,
    due: dayStartPlus(now, s.intervalDays),
  };
}

/** Interval (days) each rating would produce — used for the review button labels. */
export function previewIntervals(card: Card): Record<Rating, number> {
  return {
    again: nextState(card, 'again').intervalDays,
    hard: nextState(card, 'hard').intervalDays,
    good: nextState(card, 'good').intervalDays,
    easy: nextState(card, 'easy').intervalDays,
  };
}

/** Scheduling fields for a freshly created card: first review tomorrow. */
export function newCardSchedule(
  now: number,
): Pick<Card, 'due' | 'intervalDays' | 'ease' | 'reps' | 'lapses' | 'suspended'> {
  return { due: dayStartPlus(now, 1), intervalDays: 0, ease: START_EASE, reps: 0, lapses: 0, suspended: false };
}
