export type ID = string; // crypto.randomUUID()

export interface Goal {
  id: ID;
  title: string;
  why?: string;
  status: 'active' | 'archived';
  createdAt: number;
}

export interface Video {
  id: ID;
  url: string;
  youtubeId: string;
  title: string;
  channel?: string;
  thumbnailUrl?: string;
  goalId?: ID;
  purpose: string;
  status: 'watching' | 'logged';
  brainDump?: string;
  openQuestions: string[];
  rating?: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
  loggedAt?: number;
  // Watch progress (Phase 2). Not indexed, so no schema version bump is needed.
  positionSec?: number;
  durationSec?: number;
}

export interface TimestampNote {
  id: ID;
  videoId: ID;
  t: number;
  text: string;
  createdAt: number;
}

export interface Card {
  id: ID;
  videoId: ID;
  goalId?: ID;
  cue: string;
  answer: string;
  due: number;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReviewedAt?: number;
  suspended: boolean;
  createdAt: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewLog {
  id: ID;
  cardId: ID;
  rating: Rating;
  reviewedAt: number;
  prevInterval: number;
  nextInterval: number;
}

export interface Action {
  id: ID;
  videoId: ID;
  goalId?: ID;
  text: string;
  dueDate: number;
  doneAt?: number;
  reflection?: string;
  createdAt: number;
}

export interface Settings {
  id: 'settings';
  maxNewVideosPerDay: number;
  dailyReviewLimit: number;
  theme: 'light' | 'dark' | 'system';
  pausePrompts: boolean; // used from Phase 2 (watch page)
  timeOffsetDays: number; // debug "time travel"; 0 in normal use
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  maxNewVideosPerDay: 3,
  dailyReviewLimit: 50,
  theme: 'system',
  pausePrompts: true,
  timeOffsetDays: 0,
};
