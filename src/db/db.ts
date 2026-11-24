import Dexie, { type Table } from 'dexie';
import type { Action, Card, Goal, ReviewLog, Settings, TimestampNote, Video } from './types';

export class VidNotesDB extends Dexie {
  goals!: Table<Goal, string>;
  videos!: Table<Video, string>;
  notes!: Table<TimestampNote, string>;
  cards!: Table<Card, string>;
  reviews!: Table<ReviewLog, string>;
  actions!: Table<Action, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('vidnotes');
    this.version(1).stores({
      goals: 'id, status, createdAt',
      videos: 'id, goalId, status, createdAt, loggedAt, youtubeId',
      notes: 'id, videoId, t',
      cards: 'id, videoId, goalId, due, suspended',
      reviews: 'id, cardId, reviewedAt',
      actions: 'id, videoId, goalId, dueDate, doneAt',
      settings: 'id',
    });
  }
}

export const db = new VidNotesDB();

export const TABLE_NAMES = ['goals', 'videos', 'notes', 'cards', 'reviews', 'actions', 'settings'] as const;
export type TableName = (typeof TABLE_NAMES)[number];
