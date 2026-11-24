import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../db/repo';
import { deleteAllData, exportAll, importBackup, validateBackup } from '../db/backup';
import { dayStartPlus } from '../lib/dates';

const NOW = new Date(2026, 5, 1, 14, 0).getTime();

async function seedLoggedVideo() {
  const goalId = await repo.createGoal({ title: 'Learn Python' }, { activate: true }, NOW);
  const videoId = await repo.createVideo(
    { url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', title: 'Pandas intro', goalId, purpose: 'Learn pandas' },
    NOW,
  );
  await repo.addNote(videoId, 65, 'groupby is split-apply-combine', NOW);
  const res = await repo.logVideo(
    videoId,
    {
      brainDump: 'DataFrames, groupby, merging, reading CSVs and cleaning.',
      takeaways: [
        { cue: 'What does groupby do?', answer: 'Split-apply-combine' },
        { cue: 'How to read a CSV?', answer: 'pd.read_csv' },
        { cue: '', answer: '' }, // blank rows are ignored
      ],
      action: { text: 'Clean my CSV with pandas', dueDate: dayStartPlus(NOW, 2) },
      openQuestions: ['What is a MultiIndex?', ' '],
      rating: 4,
    },
    NOW,
  );
  return { goalId, videoId, res };
}

beforeEach(async () => {
  await deleteAllData();
});

describe('goals', () => {
  it('keeps only one active goal', async () => {
    const a = await repo.createGoal({ title: 'A' }, { activate: true }, NOW);
    const b = await repo.createGoal({ title: 'B' }, { activate: true }, NOW + 1);
    expect((await repo.getActiveGoal())?.id).toBe(b);
    await repo.activateGoal(a);
    const goals = await repo.listGoals();
    expect(goals.filter((g) => g.status === 'active').map((g) => g.id)).toEqual([a]);
  });
});

describe('logVideo', () => {
  it('logs the video, creates cards due tomorrow and one action', async () => {
    const { videoId, goalId, res } = await seedLoggedVideo();
    expect(res).toEqual({ cardCount: 2, firstDue: dayStartPlus(NOW, 1) });

    const video = await repo.getVideo(videoId);
    expect(video).toMatchObject({ status: 'logged', rating: 4, loggedAt: NOW, openQuestions: ['What is a MultiIndex?'] });

    // Not due today, due tomorrow.
    expect(await repo.countDue(NOW)).toBe(0);
    const queue = await repo.getReviewQueue(50, dayStartPlus(NOW, 1) + 3600_000);
    expect(queue).toHaveLength(2);
    expect(queue.every((c) => c.goalId === goalId)).toBe(true);

    const open = await repo.listOpenActions();
    expect(open).toHaveLength(1);
    expect(open[0].dueDate).toBe(dayStartPlus(NOW, 2));
  });

  it('requires a brain dump, a takeaway and an action', async () => {
    const id = await repo.createVideo({ url: 'u', youtubeId: 'dQw4w9WgXcQ', title: 't', purpose: 'p' }, NOW);
    const base = {
      brainDump: 'x'.repeat(25),
      takeaways: [{ cue: 'q', answer: 'a' }],
      action: { text: 'do it', dueDate: NOW },
      openQuestions: [],
    };
    await expect(repo.logVideo(id, { ...base, brainDump: 'short' }, NOW)).rejects.toThrow(/Brain dump/);
    await expect(repo.logVideo(id, { ...base, takeaways: [{ cue: 'q', answer: '' }] }, NOW)).rejects.toThrow(/takeaway/);
    await expect(repo.logVideo(id, { ...base, action: { text: ' ', dueDate: NOW } }, NOW)).rejects.toThrow(/action/);
    expect((await repo.getVideo(id))?.status).toBe('watching');
    await repo.logVideo(id, base, NOW);
    await expect(repo.logVideo(id, base, NOW)).rejects.toThrow(/already logged/);
  });
});

describe('review', () => {
  it('reschedules the card and writes a review log', async () => {
    await seedLoggedVideo();
    const tomorrow = dayStartPlus(NOW, 1) + 9 * 3600_000;
    const [card] = await repo.getReviewQueue(50, tomorrow);
    const updated = await repo.reviewCard(card.id, 'good', tomorrow);
    expect(updated.due).toBe(dayStartPlus(tomorrow, 1));
    expect(await repo.countDue(tomorrow)).toBe(1);
    const logs = await repo.listAllReviews();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ cardId: card.id, rating: 'good', prevInterval: 0, nextInterval: 1 });
  });

  it('skips suspended cards and respects the limit', async () => {
    await seedLoggedVideo();
    const t = dayStartPlus(NOW, 1);
    expect(await repo.getReviewQueue(1, t)).toHaveLength(1);
    const [c] = await repo.getReviewQueue(50, t);
    await repo.setCardSuspended(c.id, true);
    expect(await repo.countDue(t)).toBe(1);
  });
});

describe('actions', () => {
  it('completes and reopens', async () => {
    await seedLoggedVideo();
    const [a] = await repo.listOpenActions();
    await repo.completeAction(a.id, 'It worked', NOW);
    expect(await repo.listOpenActions()).toHaveLength(0);
    expect((await repo.listDoneActions())[0]).toMatchObject({ reflection: 'It worked', doneAt: NOW });
    await repo.reopenAction(a.id);
    expect(await repo.listOpenActions()).toHaveLength(1);
    expect(await repo.listDoneActions()).toHaveLength(0);
  });
});

describe('backup', () => {
  it('export → wipe → import (replace) restores everything', async () => {
    await seedLoggedVideo();
    await repo.updateSettings({ maxNewVideosPerDay: 5 });
    const before = await exportAll();

    await deleteAllData();
    expect((await exportAll()).tables.videos).toHaveLength(0);

    const v = validateBackup(JSON.parse(JSON.stringify(before)));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await importBackup(v.backup, 'replace');
    const after = await exportAll();
    expect(after.tables).toEqual(before.tables);
  });

  it('merge keeps existing rows and resolves multiple active goals', async () => {
    await seedLoggedVideo();
    const backup = await exportAll();
    await deleteAllData();
    await repo.createGoal({ title: 'Other' }, { activate: true }, NOW + 10);
    await importBackup(backup, 'merge');
    const goals = await repo.listGoals();
    expect(goals).toHaveLength(2);
    expect(goals.filter((g) => g.status === 'active')).toHaveLength(1);
  });

  it('rejects invalid files', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'other' }).ok).toBe(false);
    expect(validateBackup({ app: 'vidnotes', schemaVersion: 1, tables: { videos: 'x' } }).ok).toBe(false);
    expect(validateBackup({ app: 'vidnotes', schemaVersion: 1, tables: { cards: [{ id: 'a', cue: 'q' }] } }).ok).toBe(false);
    expect(validateBackup({ app: 'vidnotes', schemaVersion: 99, tables: {} }).ok).toBe(false);
    expect(validateBackup({ app: 'vidnotes', schemaVersion: 1, tables: {} }).ok).toBe(true);
  });
});

describe('watching (phase 2)', () => {
  it('starts at the &t= time from the pasted link and saves progress', async () => {
    const id = await repo.createVideo(
      { url: 'https://youtu.be/dQw4w9WgXcQ?t=1m30s', youtubeId: 'dQw4w9WgXcQ', title: 't', purpose: 'p' },
      NOW,
    );
    expect((await repo.getVideo(id))?.positionSec).toBe(90);
    await repo.saveWatchProgress(id, 245.7, 600.2);
    expect(await repo.getVideo(id)).toMatchObject({ positionSec: 245, durationSec: 600 });
    await repo.saveWatchProgress(id, 300); // unknown duration keeps the old one
    expect(await repo.getVideo(id)).toMatchObject({ positionSec: 300, durationSec: 600 });
  });

  it('adds, edits, orders and deletes timestamp notes', async () => {
    const id = await repo.createVideo({ url: 'u', youtubeId: 'dQw4w9WgXcQ', title: 't', purpose: 'p' }, NOW);
    const late = await repo.addNote(id, 300, ' later point ', NOW);
    const early = await repo.addNote(id, 12.9, 'first point', NOW);
    expect((await repo.listNotes(id)).map((n) => [n.t, n.text])).toEqual([
      [12, 'first point'],
      [300, 'later point'],
    ]);
    await repo.updateNote(late, { t: 5, text: 'moved' });
    expect((await repo.listNotes(id))[0]).toMatchObject({ id: late, t: 5, text: 'moved' });
    await expect(repo.updateNote(early, { text: '  ' })).rejects.toThrow(/empty/);
    await repo.deleteNote(early);
    expect(await repo.listNotes(id)).toHaveLength(1);
  });
});

describe('library & detail (phase 3)', () => {
  it('updateVideo edits fields and moves cards/actions with the goal', async () => {
    const { videoId } = await seedLoggedVideo();
    const other = await repo.createGoal({ title: 'Other' }, { activate: false }, NOW);
    await repo.updateVideo(videoId, { title: ' New title ', rating: 2, openQuestions: ['a', ' ', 'b'], goalId: other });
    const b = (await repo.getVideoBundle(videoId))!;
    expect(b.video).toMatchObject({ title: 'New title', rating: 2, openQuestions: ['a', 'b'], goalId: other });
    expect(b.cards.every((c) => c.goalId === other)).toBe(true);
    expect(b.actions.every((a) => a.goalId === other)).toBe(true);
    await repo.updateVideo(videoId, { goalId: null, rating: null });
    const b2 = (await repo.getVideoBundle(videoId))!;
    expect(b2.video.goalId).toBeUndefined();
    expect(b2.video.rating).toBeUndefined();
    expect(b2.cards.every((c) => c.goalId === undefined)).toBe(true);
    await expect(repo.updateVideo(videoId, { purpose: ' ' })).rejects.toThrow(/purpose/);
  });

  it('addCard schedules a new card for tomorrow with the video goal', async () => {
    const { videoId, goalId } = await seedLoggedVideo();
    const id = await repo.addCard(videoId, { cue: 'Q?', answer: 'A' }, NOW);
    const card = (await repo.getVideoBundle(videoId))!.cards.find((c) => c.id === id)!;
    expect(card).toMatchObject({ goalId, due: dayStartPlus(NOW, 1), reps: 0 });
    await expect(repo.addCard(videoId, { cue: 'Q', answer: ' ' })).rejects.toThrow();
  });

  it('listLibrary groups notes and cards per video; goalWeakSpots finds lapsed cards', async () => {
    const { videoId, goalId } = await seedLoggedVideo();
    const lib = await repo.listLibrary();
    expect(lib).toHaveLength(1);
    expect(lib[0]).toMatchObject({ video: { id: videoId } });
    expect(lib[0].notes).toHaveLength(1);
    expect(lib[0].cards).toHaveLength(2);

    expect(await repo.goalWeakSpots()).toEqual({});
    const t = dayStartPlus(NOW, 1);
    const [c] = await repo.getReviewQueue(50, t);
    await repo.reviewCard(c.id, 'again', t);
    const weak = await repo.goalWeakSpots();
    expect(weak[goalId].map((x) => x.id)).toEqual([c.id]);
  });
});
