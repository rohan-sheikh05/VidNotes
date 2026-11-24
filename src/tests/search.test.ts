import { describe, expect, it } from 'vitest';
import { normalize, searchLibrary, type LibraryEntry } from '../lib/search';
import type { Card, TimestampNote, Video } from '../db/types';

function entry(id: string, v: Partial<Video>, notes: string[] = [], cards: [string, string][] = []): LibraryEntry {
  const video: Video = {
    id,
    url: '',
    youtubeId: 'x',
    title: 'Untitled',
    purpose: '',
    status: 'logged',
    openQuestions: [],
    createdAt: 0,
    ...v,
  };
  return {
    video,
    notes: notes.map((text, i) => ({ id: `${id}n${i}`, videoId: id, t: i, text, createdAt: 0 }) as TimestampNote),
    cards: cards.map(([cue, answer], i) => ({ id: `${id}c${i}`, videoId: id, cue, answer }) as Card),
  };
}

const LIB = [
  entry('a', { title: 'Pandas groupby explained', goalId: 'g1', rating: 5, loggedAt: 3 }, ['split apply combine']),
  entry('b', { title: 'Merging DataFrames', goalId: 'g1', rating: 3, loggedAt: 2, brainDump: 'joins work like SQL joins on a key' }),
  entry('c', { title: 'Public speaking basics', status: 'watching', createdAt: 5 }, ['pause before the key point']),
  entry('d', { title: 'Résumé tips', goalId: 'g2', rating: 4, loggedAt: 1 }, [], [['What makes a strong résumé?', 'Results, not duties']]),
];

const ids = (q: Parameters<typeof searchLibrary>[1]) => searchLibrary(LIB, q).map((h) => h.entry.video.id);

describe('searchLibrary', () => {
  it('returns everything, most recent first, with an empty query', () => {
    expect(ids({ query: '' })).toEqual(['c', 'a', 'b', 'd']);
  });

  it('searches notes, brain dumps and takeaways, reporting where it matched', () => {
    const hits = searchLibrary(LIB, { query: 'key' });
    expect(hits.map((h) => h.entry.video.id).sort()).toEqual(['b', 'c']);
    const b = hits.find((h) => h.entry.video.id === 'b')!;
    expect(b.fields).toContain('brain dump');
    expect(b.snippet).toContain('key');
  });

  it('ranks title matches first and requires every term', () => {
    expect(ids({ query: 'groupby' })).toEqual(['a']);
    expect(ids({ query: 'split combine' })).toEqual(['a']);
    expect(ids({ query: 'split nonsense' })).toEqual([]);
  });

  it('ignores case and accents', () => {
    expect(ids({ query: 'RESUME' })).toEqual(['d']);
    expect(normalize('Résumé')).toBe('resume');
  });

  it('filters by goal, no goal, status and rating', () => {
    expect(ids({ query: '', goalId: 'g1' })).toEqual(['a', 'b']);
    expect(ids({ query: '', goalId: 'none' })).toEqual(['c']);
    expect(ids({ query: '', status: 'watching' })).toEqual(['c']);
    expect(ids({ query: '', minRating: 4 })).toEqual(['a', 'd']);
    expect(ids({ query: 'joins', goalId: 'g2' })).toEqual([]);
  });
});
