import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Library as LibraryIcon, Search, Star } from 'lucide-react';
import * as repo from '../db/repo';
import EmptyState from '../components/EmptyState';
import { searchLibrary, type LibraryFilter } from '../lib/search';
import { formatDate } from '../lib/dates';

export default function Library() {
  const entries = useLiveQuery(() => repo.listLibrary(), []);
  const goals = useLiveQuery(() => repo.listGoals(), []);
  // Query + filters live in the URL so results survive back-navigation and can be bookmarked.
  const [params, setParams] = useSearchParams();
  const filter: LibraryFilter = {
    query: params.get('q') ?? '',
    goalId: params.get('goal') ?? '',
    status: (params.get('status') as LibraryFilter['status']) ?? '',
    minRating: Number(params.get('rating')) || 0,
  };
  const [query, setQuery] = useState(filter.query);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const hits = useMemo(() => (entries ? searchLibrary(entries, { ...filter, query }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, query, filter.goalId, filter.status, filter.minRating]);
  const goalTitle = new Map((goals ?? []).map((g) => [g.id, g.title]));

  if (!entries) return null;

  return (
    <div className="space-y-4">
      <h1>Library</h1>

      {entries.length === 0 ? (
        <EmptyState icon={LibraryIcon} title="Your library is empty" action={<Link to="/video/new" className="btn-primary">Log a video</Link>}>
          Every video you log lands here, with its notes, takeaways and brain dump, all searchable.
        </EmptyState>
      ) : (
        <>
          <div className="relative">
            <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
            <label htmlFor="lib-q" className="sr-only">
              Search titles, notes, takeaways and brain dumps
            </label>
            <input
              id="lib-q"
              type="search"
              className="input rounded-full pl-11"
              placeholder="Search titles, notes, takeaways, brain dumps…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                set('q', e.target.value);
              }}
            />
          </div>

          {/* Filters: one row, above the results they scope. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
            <label className="sr-only" htmlFor="f-goal">
              Goal
            </label>
            <select id="f-goal" className="input w-auto rounded-full py-2 text-sm" value={filter.goalId} onChange={(e) => set('goal', e.target.value)}>
              <option value="">All goals</option>
              <option value="none">No goal</option>
              {goals?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-status">
              Status
            </label>
            <select id="f-status" className="input w-auto rounded-full py-2 text-sm" value={filter.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Any status</option>
              <option value="logged">Logged</option>
              <option value="watching">Not logged yet</option>
            </select>
            <label className="sr-only" htmlFor="f-rating">
              Rating
            </label>
            <select
              id="f-rating"
              className="input w-auto rounded-full py-2 text-sm"
              value={String(filter.minRating || '')}
              onChange={(e) => set('rating', e.target.value)}
            >
              <option value="">Any rating</option>
              <option value="3">3+ stars</option>
              <option value="4">4+ stars</option>
              <option value="5">5 stars</option>
            </select>
          </div>

          <p className="hint" role="status">
            {hits.length} {hits.length === 1 ? 'video' : 'videos'}
          </p>

          {hits.length === 0 ? (
            <EmptyState icon={Search} title="No matches">
              Try fewer words, or clear a filter.
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {hits.map(({ entry: { video: v, cards, notes }, fields, snippet }) => (
                <li key={v.id}>
                  <Link to={`/video/${v.id}`} className="group flex items-start gap-3 rounded-card">
                    <span className="relative w-36 shrink-0 overflow-hidden rounded-card bg-surface-2 sm:w-44">
                      {v.thumbnailUrl && (
                        <img src={v.thumbnailUrl} alt="" width={176} height={99} loading="lazy" className="aspect-video w-full object-cover" />
                      )}
                      {v.status === 'watching' && (
                        <span className="absolute bottom-1.5 right-1 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium leading-none text-white">
                          Not logged
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium leading-snug group-hover:underline">{v.title}</span>
                      <span className="mt-0.5 block text-xs text-fg-muted">
                        {[
                          v.goalId ? goalTitle.get(v.goalId) : null,
                          v.loggedAt ? formatDate(v.loggedAt) : `Added ${formatDate(v.createdAt)}`,
                          `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`,
                          notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        {v.rating && (
                          <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
                            · <Star size={11} aria-hidden className="fill-current" /> {v.rating}
                          </span>
                        )}
                      </span>
                      {snippet && (
                        <span className="mt-1 line-clamp-2 block text-sm text-fg-muted [&>span:first-child]:inline-block">
                          <span className="font-medium text-fg first-letter:uppercase">{fields.find((f) => f !== 'title')}:</span> {snippet}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
