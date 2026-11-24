import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChartColumn, Flame } from 'lucide-react';
import * as repo from '../db/repo';
import ColumnChart from '../components/ColumnChart';
import EmptyState from '../components/EmptyState';
import { now } from '../lib/dates';
import { appliedRatio, goalLapseRates, recentRetention, reviewForecast, reviewStreak, videosPerWeek, weakSpots } from '../lib/stats';
import { format } from 'date-fns';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

function StatTile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="panel">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-3xl font-bold tracking-tight">
        {icon}
        {value}
      </p>
      {sub && <p className="hint mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

export default function Stats() {
  const data = useLiveQuery(() => repo.statsData(), []);
  if (!data) return null;

  const t = now();
  const { videos, actions, cards, reviews, goals } = data;
  const applied = appliedRatio(videos, actions);
  const streak = reviewStreak(reviews, t);
  const ret = recentRetention(reviews, t);
  const weeks = videosPerWeek(videos, t, 8);
  const forecast = reviewForecast(cards, t, 14);
  const weakGoals = goalLapseRates(cards, reviews, goals);
  const weakCards = weakSpots(cards, 5);
  const videoTitle = new Map(videos.map((v) => [v.id, v.title]));

  if (applied.logged === 0 && reviews.length === 0) {
    return (
      <div className="space-y-4">
        <h1>Stats</h1>
        <EmptyState icon={ChartColumn} title="Nothing to measure yet" action={<Link to="/video/new" className="btn-primary">Log a video</Link>}>
          Log a video, review its cards and tick off its action. Your progress shows up here.
        </EmptyState>
      </div>
    );
  }

  const weekTotal = weeks.reduce((s, w) => s + w.count, 0);
  const next14 = forecast.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      <h1>Stats</h1>

      {/* Hero figure: the one number this page leads with. */}
      <section className="panel p-5" aria-labelledby="applied-h">
        <p id="applied-h" className="text-sm font-medium text-fg-muted">
          Applied ratio
        </p>
        <p className="mt-1 text-6xl font-bold tracking-tight">{pct(applied.ratio)}</p>
        <p className="hint mt-1">
          {applied.applied} of {applied.logged} logged {applied.logged === 1 ? 'video has' : 'videos have'} a completed action. Watching
          only sticks when you use it.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Key numbers">
        <StatTile label="Review streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} icon={streak > 0 ? <Flame size={24} aria-hidden className="text-accent" /> : undefined} />
        <StatTile label="Retention, 30 days" value={pct(ret)} sub="Reviews not marked “Forgot”" />
        <StatTile label="Videos logged" value={String(applied.logged)} sub={`${cards.length} review cards`} />
      </section>

      <section className="panel" aria-labelledby="weekly-h">
        <h2 id="weekly-h">Videos logged per week</h2>
        <p className="hint mb-3">Last 8 weeks · this week highlighted</p>
        <ColumnChart
          data={weeks.map((w) => ({
            key: w.weekStart,
            label: w.current ? 'This week' : w.label,
            fullLabel: `Week of ${format(w.weekStart, 'd MMM yyyy')}${w.current ? ' (this week)' : ''}`,
            value: w.count,
            emphasis: w.current,
          }))}
          unit={['video', 'videos']}
          summary={`Videos logged per week over the last 8 weeks: ${weekTotal} in total, ${weeks[weeks.length - 1].count} this week.`}
        />
      </section>

      <section className="panel" aria-labelledby="forecast-h">
        <h2 id="forecast-h">Upcoming reviews</h2>
        <p className="hint mb-3">Next 14 days · overdue cards count as today</p>
        <ColumnChart
          data={forecast.map((d) => ({
            key: d.day,
            label: d.today ? 'Today' : d.label,
            fullLabel: format(d.day, 'EEEE d MMM') + (d.today ? ' (today)' : ''),
            value: d.count,
            emphasis: d.today,
          }))}
          unit={['card', 'cards']}
          summary={`Reviews due over the next 14 days: ${next14} cards, ${forecast[0].count} today.`}
        />
      </section>

      <section className="panel" aria-labelledby="weak-goals-h">
        <h2 id="weak-goals-h">Weakest goals</h2>
        <p className="hint mb-3">Share of reviews marked “Forgot” per goal</p>
        {weakGoals.length === 0 ? (
          <p className="hint">Not enough reviews yet. Each goal needs at least 3.</p>
        ) : (
          /* Meter list: name, bar, figure per row; track is a lighter step of the accent ramp. */
          <ul className="space-y-3">
            {weakGoals.map((g) => (
              <li key={g.goalId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{g.title}</span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{pct(g.rate)}</strong> <span className="text-fg-muted">of {g.reviews}</span>
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--chart-track))]"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(g.rate * 100)}
                  aria-label={`${g.title}: ${pct(g.rate)} forgotten`}
                >
                  <div className="h-full rounded-full bg-[rgb(var(--chart-accent))]" style={{ width: `${Math.max(2, g.rate * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="weak-cards-h">
        <h2 id="weak-cards-h" className="mb-3">
          Cards you forget most
        </h2>
        {weakCards.length === 0 ? (
          <p className="hint">No forgotten cards yet. Nice.</p>
        ) : (
          <ul className="divide-y divide-border">
            {weakCards.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.cue}</p>
                  <Link to={`/video/${c.videoId}`} className="text-xs text-link hover:underline">
                    {videoTitle.get(c.videoId) ?? 'Video'}
                  </Link>
                </div>
                <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-on-danger-soft">
                  forgot {c.lapses}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
