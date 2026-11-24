import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Layers, Play, Plus, Target, TriangleAlert } from 'lucide-react';
import * as repo from '../db/repo';
import ActionItem from '../components/ActionItem';
import EmptyState from '../components/EmptyState';
import { formatDate, now } from '../lib/dates';
import { formatTimestamp } from '../lib/youtube';
import { watchedFraction } from '../lib/watch';

export default function Today() {
  const goal = useLiveQuery(() => repo.getActiveGoal(), []);
  const due = useLiveQuery(() => repo.countDue(), []);
  const actions = useLiveQuery(() => repo.listDueActions(), []);
  const watching = useLiveQuery(() => repo.listWatchingVideos(), []);
  const startedToday = useLiveQuery(() => repo.countVideosStartedToday(), []);
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const actionVideos = useLiveQuery(
    async () => (actions ? repo.getVideos(actions.map((a) => a.videoId)) : []),
    [actions],
  );

  if (due === undefined || actions === undefined || watching === undefined || settings === undefined) return null;

  const overCap = (startedToday ?? 0) >= settings.maxNewVideosPerDay;

  return (
    <div className="space-y-8">
      <header>
        <p className="hint font-medium">{formatDate(now())}</p>
        <h1 className="text-3xl">Today</h1>
      </header>

      {goal ? (
        <section className="flex gap-3 rounded-card bg-primary-soft p-4 text-on-primary-soft" aria-label="Active goal">
          <Target size={20} aria-hidden className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Active goal</p>
            <p className="mt-0.5 text-lg font-bold leading-snug">{goal.title}</p>
            {goal.why && <p className="mt-1 text-sm">{goal.why}</p>}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Target}
          title="No active goal yet"
          action={
            <Link to="/goals" className="btn-secondary">
              Set a goal
            </Link>
          }
        >
          Depth beats breadth. Pick one thing you're learning right now and tie your videos to it.
        </EmptyState>
      )}

      {/* The one primary action on this screen. */}
      <section className="panel p-5" aria-label="Reviews">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Reviews due today</p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums tracking-tight">{due}</p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
            <Layers size={26} aria-hidden />
          </span>
        </div>
        {due > 0 ? (
          <Link to="/review" className="btn-primary mt-4 w-full py-3 text-lg">
            Start review <ArrowRight size={20} aria-hidden />
          </Link>
        ) : (
          <p className="hint mt-3">No reviews due. Log a video and write takeaways to start building memory.</p>
        )}
      </section>

      <section aria-labelledby="actions-h">
        <h2 id="actions-h" className="mb-3">
          Actions due
        </h2>
        {actions.length === 0 ? (
          <p className="hint">Nothing due. Actions from your logged videos show up here on their due date.</p>
        ) : (
          <ul className="space-y-2">
            {actions.map((a, i) => (
              <ActionItem key={a.id} action={a} video={actionVideos?.[i]} />
            ))}
          </ul>
        )}
      </section>

      {watching.length > 0 && (
        <section aria-labelledby="unfinished-h">
          <h2 id="unfinished-h" className="mb-3">
            Unfinished videos
          </h2>
          <ul className="space-y-4">
            {watching.map((v) => (
              <li key={v.id} className="flex items-start gap-3">
                {/* Thumbnail with a corner badge and real watch progress, like a video feed. */}
                <Link to={`/video/${v.id}/watch`} className="relative w-40 shrink-0 overflow-hidden rounded-card bg-surface-2" tabIndex={-1} aria-hidden>
                  {v.thumbnailUrl && (
                    <img src={v.thumbnailUrl} alt="" width={160} height={90} loading="lazy" className="aspect-video w-full object-cover" />
                  )}
                  <span className="absolute bottom-1.5 right-1 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium leading-none text-white">
                    {v.positionSec ? formatTimestamp(v.positionSec) : 'Not started'}
                  </span>
                  {watchedFraction(v.positionSec, v.durationSec) !== null && (
                    <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/40">
                      <span className="block h-full bg-accent" style={{ width: `${watchedFraction(v.positionSec, v.durationSec)! * 100}%` }} />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium leading-snug">{v.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">{v.purpose}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link to={`/video/${v.id}/watch`} className="btn-primary min-h-[36px] px-3 text-sm">
                      <Play size={14} aria-hidden /> {v.positionSec ? 'Continue' : 'Watch'}
                    </Link>
                    <Link to={`/video/${v.id}/log`} className="btn-secondary min-h-[36px] px-3 text-sm">
                      Finish log
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        {overCap && (
          <p className="notice-warning">
            <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
            You've started {startedToday} videos today. Review or apply something first?
          </p>
        )}
        <Link to="/video/new" className="btn-secondary w-full">
          <Plus size={18} aria-hidden /> Log a new video
        </Link>
      </section>
    </div>
  );
}
