/** Library search (spec §5.7): titles, notes, takeaways and brain dumps, plus filters. Pure. */
import type { Card, TimestampNote, Video } from '../db/types';

export interface LibraryEntry {
  video: Video;
  notes: TimestampNote[];
  cards: Card[];
}

export interface LibraryFilter {
  query: string;
  goalId?: string; // '' = any, 'none' = videos without a goal
  status?: '' | 'watching' | 'logged';
  minRating?: number; // 0 = any
}

export type MatchField = 'title' | 'purpose' | 'notes' | 'takeaways' | 'brain dump' | 'questions' | 'channel';

export interface LibraryHit {
  entry: LibraryEntry;
  fields: MatchField[];
  snippet?: string;
}

/** Lowercase and strip diacritics, so "resume" finds "Résumé". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function fieldsOf(e: LibraryEntry): [MatchField, string][] {
  const v = e.video;
  return [
    ['title', v.title],
    ['channel', v.channel ?? ''],
    ['purpose', v.purpose],
    ['takeaways', e.cards.map((c) => `${c.cue}\n${c.answer}`).join('\n')],
    ['notes', e.notes.map((n) => n.text).join('\n')],
    ['brain dump', v.brainDump ?? ''],
    ['questions', v.openQuestions.join('\n')],
  ];
}

function snippetAround(text: string, term: string, radius = 50): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const i = normalize(flat).indexOf(term);
  if (i < 0) return flat.slice(0, radius * 2);
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + term.length + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

export function searchLibrary(entries: LibraryEntry[], filter: LibraryFilter): LibraryHit[] {
  const terms = normalize(filter.query).split(/\s+/).filter(Boolean);
  const hits: (LibraryHit & { score: number })[] = [];

  for (const e of entries) {
    const v = e.video;
    if (filter.goalId === 'none' ? !!v.goalId : filter.goalId && v.goalId !== filter.goalId) continue;
    if (filter.status && v.status !== filter.status) continue;
    if (filter.minRating && (v.rating ?? 0) < filter.minRating) continue;

    if (terms.length === 0) {
      hits.push({ entry: e, fields: [], score: 0 });
      continue;
    }
    const fields = fieldsOf(e).map(([name, text]) => [name, text, normalize(text)] as const);
    // Every term must appear somewhere (AND).
    if (!terms.every((t) => fields.some(([, , n]) => n.includes(t)))) continue;
    const matched = fields.filter(([, , n]) => terms.some((t) => n.includes(t)));
    const titleHit = matched.some(([name]) => name === 'title');
    const best = matched.find(([name]) => name !== 'title') ?? matched[0];
    hits.push({
      entry: e,
      fields: matched.map(([name]) => name),
      snippet: best && best[0] !== 'title' ? snippetAround(best[1], terms.find((t) => best[2].includes(t)) ?? terms[0]) : undefined,
      score: (titleHit ? 10 : 0) + matched.length,
    });
  }

  const recency = (h: LibraryHit) => h.entry.video.loggedAt ?? h.entry.video.createdAt;
  return hits
    .sort((a, b) => b.score - a.score || recency(b) - recency(a))
    .map(({ score: _score, ...h }) => h);
}
