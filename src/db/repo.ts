/**
 * All reads and writes go through this module. Pages and components never import `db` directly.
 * Functions that create timestamps take an optional `at` (defaults to the app's now(), which
 * respects the debug time-travel offset).
 */
import { db } from './db';
import {
  DEFAULT_SETTINGS,
  type Action,
  type Card,
  type Goal,
  type ID,
  type Rating,
  type ReviewLog,
  type Settings,
  type TimestampNote,
  type Video,
} from './types';
import { now, startOfDay } from '../lib/dates';
import { newCardSchedule, schedule } from '../lib/scheduler';
import { parseStartTime } from '../lib/youtube';
import { weakSpots } from '../lib/stats';
import type { LibraryEntry } from '../lib/search';

const uid = (): ID => crypto.randomUUID();

export const MIN_BRAIN_DUMP = 20;
export const MAX_TAKEAWAYS = 3;

/* ---------------------------------- settings ---------------------------------- */

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...s, id: 'settings' };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}

/* ------------------------------------ goals ----------------------------------- */

export async function listGoals(): Promise<Goal[]> {
  const goals = await db.goals.orderBy('createdAt').reverse().toArray();
  // Active goal first.
  return goals.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
}

export function getActiveGoal(): Promise<Goal | undefined> {
  return db.goals.where('status').equals('active').first();
}

export function getGoal(id: ID): Promise<Goal | undefined> {
  return db.goals.get(id);
}

export async function createGoal(
  input: { title: string; why?: string },
  opts: { activate: boolean },
  at = now(),
): Promise<ID> {
  const title = input.title.trim();
  if (!title) throw new Error('A goal needs a title.');
  const goal: Goal = {
    id: uid(),
    title,
    why: input.why?.trim() || undefined,
    status: 'archived',
    createdAt: at,
  };
  await db.transaction('rw', db.goals, async () => {
    await db.goals.add(goal);
    if (opts.activate) await activateGoal(goal.id);
  });
  return goal.id;
}

export async function updateGoal(id: ID, patch: { title?: string; why?: string }): Promise<void> {
  const changes: Partial<Goal> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error('A goal needs a title.');
    changes.title = title;
  }
  if (patch.why !== undefined) changes.why = patch.why.trim() || undefined;
  await db.goals.update(id, changes);
}

/** Only one active goal at a time: activating one archives the current active goal. */
export async function activateGoal(id: ID): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    await db.goals.where('status').equals('active').modify({ status: 'archived' });
    await db.goals.update(id, { status: 'active' });
  });
}

export async function archiveGoal(id: ID): Promise<void> {
  await db.goals.update(id, { status: 'archived' });
}

/** Counts shown on the Goals page. */
export async function goalCounts(): Promise<Record<ID, { videos: number; cards: number; actionsDone: number }>> {
  const [videos, cards, actions] = await Promise.all([
    db.videos.where('status').equals('logged').toArray(),
    db.cards.toArray(),
    db.actions.toArray(),
  ]);
  const out: Record<ID, { videos: number; cards: number; actionsDone: number }> = {};
  const get = (id: ID) => (out[id] ??= { videos: 0, cards: 0, actionsDone: 0 });
  for (const v of videos) if (v.goalId) get(v.goalId).videos++;
  for (const c of cards) if (c.goalId) get(c.goalId).cards++;
  for (const a of actions) if (a.goalId && a.doneAt) get(a.goalId).actionsDone++;
  return out;
}

/* ----------------------------------- videos ----------------------------------- */

export interface NewVideoInput {
  url: string;
  youtubeId: string;
  title: string;
  channel?: string;
  thumbnailUrl?: string;
  goalId?: ID;
  purpose: string;
}

export async function createVideo(input: NewVideoInput, at = now()): Promise<ID> {
  const purpose = input.purpose.trim();
  if (!purpose) throw new Error('Write what you want to get from this video first.');
  const title = input.title.trim();
  if (!title) throw new Error('The video needs a title.');
  const video: Video = {
    id: uid(),
    url: input.url.trim(),
    youtubeId: input.youtubeId,
    title,
    channel: input.channel,
    thumbnailUrl: input.thumbnailUrl,
    goalId: input.goalId || undefined,
    purpose,
    status: 'watching',
    openQuestions: [],
    createdAt: at,
    positionSec: parseStartTime(input.url) ?? undefined, // honour a &t= in the pasted link
  };
  await db.videos.add(video);
  return video.id;
}

export function getVideo(id: ID): Promise<Video | undefined> {
  return db.videos.get(id);
}

export function getVideos(ids: ID[]): Promise<(Video | undefined)[]> {
  return db.videos.bulkGet(ids);
}

export function findVideoByYoutubeId(youtubeId: string): Promise<Video | undefined> {
  return db.videos.where('youtubeId').equals(youtubeId).first();
}

export function listWatchingVideos(): Promise<Video[]> {
  return db.videos.where('status').equals('watching').sortBy('createdAt');
}

/** Videos started (created) today — drives the soft daily cap warning. */
export function countVideosStartedToday(at = now()): Promise<number> {
  return db.videos.where('createdAt').aboveOrEqual(startOfDay(at)).count();
}

/** Deletes a video and everything that hangs off it. */
export async function deleteVideo(id: ID): Promise<void> {
  await db.transaction('rw', [db.videos, db.notes, db.cards, db.reviews, db.actions], async () => {
    const cardIds = (await db.cards.where('videoId').equals(id).primaryKeys()) as ID[];
    await db.reviews.where('cardId').anyOf(cardIds).delete();
    await db.cards.where('videoId').equals(id).delete();
    await db.notes.where('videoId').equals(id).delete();
    await db.actions.where('videoId').equals(id).delete();
    await db.videos.delete(id);
  });
}

export interface VideoPatch {
  title?: string;
  purpose?: string;
  goalId?: ID | null; // null = no goal
  brainDump?: string;
  openQuestions?: string[];
  rating?: 1 | 2 | 3 | 4 | 5 | null;
}

/** Edit a video (Video detail page). Changing the goal moves its cards and actions with it. */
export async function updateVideo(id: ID, patch: VideoPatch): Promise<void> {
  const changes: Partial<Video> = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error('The video needs a title.');
    changes.title = patch.title.trim();
  }
  if (patch.purpose !== undefined) {
    if (!patch.purpose.trim()) throw new Error('The purpose cannot be empty.');
    changes.purpose = patch.purpose.trim();
  }
  if (patch.brainDump !== undefined) changes.brainDump = patch.brainDump.trim() || undefined;
  if (patch.openQuestions !== undefined) changes.openQuestions = patch.openQuestions.map((q) => q.trim()).filter(Boolean);
  if (patch.rating !== undefined) changes.rating = patch.rating ?? undefined;
  await db.transaction('rw', [db.videos, db.cards, db.actions], async () => {
    if (patch.goalId !== undefined) {
      const goalId = patch.goalId ?? undefined;
      changes.goalId = goalId;
      await db.cards.where('videoId').equals(id).modify({ goalId });
      await db.actions.where('videoId').equals(id).modify({ goalId });
    }
    await db.videos.update(id, changes);
  });
}

/** Everything about one video, for the detail page. */
export async function getVideoBundle(id: ID) {
  const [video, notes, cards, actions] = await Promise.all([
    db.videos.get(id),
    db.notes.where('videoId').equals(id).sortBy('t'),
    db.cards.where('videoId').equals(id).sortBy('createdAt'),
    db.actions.where('videoId').equals(id).sortBy('createdAt'),
  ]);
  return video ? { video, notes, cards, actions } : null;
}

/** All videos with their notes and cards, for library search. */
export async function listLibrary(): Promise<LibraryEntry[]> {
  const [videos, notes, cards] = await Promise.all([db.videos.toArray(), db.notes.toArray(), db.cards.toArray()]);
  const byVideo = <T extends { videoId: ID }>(rows: T[]) => {
    const m = new Map<ID, T[]>();
    for (const r of rows) m.set(r.videoId, [...(m.get(r.videoId) ?? []), r]);
    return m;
  };
  const n = byVideo(notes);
  const c = byVideo(cards);
  return videos.map((video) => ({ video, notes: n.get(video.id) ?? [], cards: c.get(video.id) ?? [] }));
}

/** Raw tables the Stats page computes from. */
export async function statsData() {
  const [videos, actions, cards, reviews, goals] = await Promise.all([
    db.videos.toArray(),
    db.actions.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.goals.toArray(),
  ]);
  return { videos, actions, cards, reviews, goals };
}

/** For each goal: the cards it lapses on most (Goals page "weak spots"). */
export async function goalWeakSpots(n = 3): Promise<Record<ID, Card[]>> {
  const cards = await db.cards.toArray();
  const out: Record<ID, Card[]> = {};
  const byGoal = new Map<ID, Card[]>();
  for (const c of cards) if (c.goalId) byGoal.set(c.goalId, [...(byGoal.get(c.goalId) ?? []), c]);
  for (const [g, list] of byGoal) {
    const weak = weakSpots(list, n);
    if (weak.length) out[g] = weak;
  }
  return out;
}

/* ------------------------------- timestamp notes ------------------------------ */

export function listNotes(videoId: ID): Promise<TimestampNote[]> {
  return db.notes.where('videoId').equals(videoId).sortBy('t');
}

export async function addNote(videoId: ID, t: number, text: string, at = now()): Promise<ID> {
  const note: TimestampNote = { id: uid(), videoId, t: Math.max(0, Math.floor(t)), text: text.trim(), createdAt: at };
  await db.notes.add(note);
  return note.id;
}

export async function updateNote(id: ID, patch: { t?: number; text?: string }): Promise<void> {
  const changes: Partial<TimestampNote> = {};
  if (patch.t !== undefined) changes.t = Math.max(0, Math.floor(patch.t));
  if (patch.text !== undefined) {
    if (!patch.text.trim()) throw new Error('A note cannot be empty.');
    changes.text = patch.text.trim();
  }
  await db.notes.update(id, changes);
}

export async function deleteNote(id: ID): Promise<void> {
  await db.notes.delete(id);
}

/** Remember where the user stopped watching, so "Continue" resumes there. */
export async function saveWatchProgress(videoId: ID, positionSec: number, durationSec?: number): Promise<void> {
  const changes: Partial<Video> = { positionSec: Math.max(0, Math.floor(positionSec)) };
  if (durationSec && durationSec > 0) changes.durationSec = Math.floor(durationSec);
  await db.videos.update(videoId, changes);
}

/* ----------------------------------- logging ---------------------------------- */

export interface LogInput {
  brainDump: string;
  takeaways: { cue: string; answer: string }[];
  action: { text: string; dueDate: number };
  openQuestions: string[];
  rating?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Completes the Log wizard: the video becomes 'logged', each takeaway becomes a card due
 * tomorrow, and the action is created. A video needs >=1 takeaway and 1 action to be logged.
 */
export async function logVideo(videoId: ID, input: LogInput, at = now()): Promise<{ cardCount: number; firstDue: number }> {
  const brainDump = input.brainDump.trim();
  const takeaways = input.takeaways
    .map((t) => ({ cue: t.cue.trim(), answer: t.answer.trim() }))
    .filter((t) => t.cue && t.answer);
  const actionText = input.action.text.trim();

  if (brainDump.length < MIN_BRAIN_DUMP) throw new Error(`Brain dump needs at least ${MIN_BRAIN_DUMP} characters.`);
  if (takeaways.length < 1) throw new Error('Add at least one takeaway (cue + answer).');
  if (takeaways.length > MAX_TAKEAWAYS) throw new Error(`At most ${MAX_TAKEAWAYS} takeaways per video.`);
  if (!actionText) throw new Error('Add one concrete action.');

  const sched = newCardSchedule(at);

  await db.transaction('rw', [db.videos, db.cards, db.actions], async () => {
    const video = await db.videos.get(videoId);
    if (!video) throw new Error('Video not found.');
    if (video.status === 'logged') throw new Error('This video is already logged.');

    await db.videos.update(videoId, {
      status: 'logged',
      brainDump,
      openQuestions: input.openQuestions.map((q) => q.trim()).filter(Boolean),
      rating: input.rating,
      loggedAt: at,
    });

    const cards: Card[] = takeaways.map((t) => ({
      id: uid(),
      videoId,
      goalId: video.goalId,
      cue: t.cue,
      answer: t.answer,
      ...sched,
      createdAt: at,
    }));
    await db.cards.bulkAdd(cards);

    const action: Action = {
      id: uid(),
      videoId,
      goalId: video.goalId,
      text: actionText,
      dueDate: startOfDay(input.action.dueDate),
      createdAt: at,
    };
    await db.actions.add(action);
  });

  return { cardCount: takeaways.length, firstDue: sched.due };
}

/** Add a takeaway card to an already-logged video (Video detail page). First review tomorrow. */
export async function addCard(videoId: ID, draft: { cue: string; answer: string }, at = now()): Promise<ID> {
  const cue = draft.cue.trim();
  const answer = draft.answer.trim();
  if (!cue || !answer) throw new Error('A card needs both a cue and an answer.');
  const video = await db.videos.get(videoId);
  if (!video) throw new Error('Video not found.');
  const card: Card = { id: uid(), videoId, goalId: video.goalId, cue, answer, ...newCardSchedule(at), createdAt: at };
  await db.cards.add(card);
  return card.id;
}

/* ----------------------------------- review ----------------------------------- */

/** Cards due today or earlier, not suspended, oldest due first, capped at `limit`. */
export async function getReviewQueue(limit: number, at = now()): Promise<Card[]> {
  const cards = await db.cards
    .where('due')
    .belowOrEqual(startOfDay(at))
    .filter((c) => !c.suspended)
    .toArray(); // index order = due ascending
  return cards.slice(0, Math.max(0, limit));
}

export function countDue(at = now()): Promise<number> {
  return db.cards
    .where('due')
    .belowOrEqual(startOfDay(at))
    .filter((c) => !c.suspended)
    .count();
}

export async function reviewCard(cardId: ID, rating: Rating, at = now()): Promise<Card> {
  return db.transaction('rw', [db.cards, db.reviews], async () => {
    const card = await db.cards.get(cardId);
    if (!card) throw new Error('Card not found.');
    const changes = schedule(card, rating, at);
    await db.cards.update(cardId, changes);
    const log: ReviewLog = {
      id: uid(),
      cardId,
      rating,
      reviewedAt: at,
      prevInterval: card.intervalDays,
      nextInterval: changes.intervalDays ?? card.intervalDays,
    };
    await db.reviews.add(log);
    return { ...card, ...changes };
  });
}

export async function updateCard(id: ID, patch: { cue?: string; answer?: string }): Promise<void> {
  const changes: Partial<Card> = {};
  if (patch.cue !== undefined) {
    if (!patch.cue.trim()) throw new Error('Cue cannot be empty.');
    changes.cue = patch.cue.trim();
  }
  if (patch.answer !== undefined) {
    if (!patch.answer.trim()) throw new Error('Answer cannot be empty.');
    changes.answer = patch.answer.trim();
  }
  await db.cards.update(id, changes);
}

export async function setCardSuspended(id: ID, suspended: boolean): Promise<void> {
  await db.cards.update(id, { suspended });
}

export async function deleteCard(id: ID): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviews], async () => {
    await db.reviews.where('cardId').equals(id).delete();
    await db.cards.delete(id);
  });
}

export function listReviewsSince(since: number): Promise<ReviewLog[]> {
  return db.reviews.where('reviewedAt').aboveOrEqual(since).toArray();
}

export function listAllReviews(): Promise<ReviewLog[]> {
  return db.reviews.toArray();
}

/* ----------------------------------- actions ---------------------------------- */

export function listOpenActions(): Promise<Action[]> {
  return db.actions
    .orderBy('dueDate')
    .filter((a) => !a.doneAt)
    .toArray();
}

/** Open actions due today or earlier. */
export function listDueActions(at = now()): Promise<Action[]> {
  return db.actions
    .where('dueDate')
    .belowOrEqual(startOfDay(at))
    .filter((a) => !a.doneAt)
    .toArray();
}

export function listDoneActions(): Promise<Action[]> {
  // Records without doneAt are not in the doneAt index, so this only yields done actions.
  return db.actions.orderBy('doneAt').reverse().toArray();
}

export async function completeAction(id: ID, reflection?: string, at = now()): Promise<void> {
  await db.actions.update(id, { doneAt: at, reflection: reflection?.trim() || undefined });
}

export async function reopenAction(id: ID): Promise<void> {
  // Dexie removes keys set to undefined.
  await db.actions.update(id, { doneAt: undefined });
}

export async function updateAction(id: ID, patch: { text?: string; dueDate?: number }): Promise<void> {
  const changes: Partial<Action> = {};
  if (patch.text !== undefined) {
    if (!patch.text.trim()) throw new Error('Action cannot be empty.');
    changes.text = patch.text.trim();
  }
  if (patch.dueDate !== undefined) changes.dueDate = startOfDay(patch.dueDate);
  await db.actions.update(id, changes);
}

export async function deleteAction(id: ID): Promise<void> {
  await db.actions.delete(id);
}
