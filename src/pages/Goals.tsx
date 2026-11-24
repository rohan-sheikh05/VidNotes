import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Target } from 'lucide-react';
import * as repo from '../db/repo';
import type { Goal } from '../db/types';
import EmptyState from '../components/EmptyState';

function GoalForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  showActivate,
}: {
  initial?: Goal;
  submitLabel: string;
  onSubmit: (v: { title: string; why: string; activate: boolean }) => Promise<void>;
  onCancel?: () => void;
  showActivate?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [why, setWhy] = useState(initial?.why ?? '');
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSubmit({ title, why, activate });
          if (!initial) {
            setTitle('');
            setWhy('');
          }
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <div>
        <label className="label" htmlFor={`gt-${initial?.id ?? 'new'}`}>
          Goal
        </label>
        <input
          id={`gt-${initial?.id ?? 'new'}`}
          className="input"
          placeholder="Learn Python for data analysis"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor={`gw-${initial?.id ?? 'new'}`}>
          Why? <span className="font-normal text-fg-muted">(shown on Today)</span>
        </label>
        <input id={`gw-${initial?.id ?? 'new'}`} className="input" value={why} onChange={(e) => setWhy(e.target.value)} />
      </div>
      {showActivate && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
          Make this my active goal
        </label>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={!title.trim()}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function Goals() {
  const goals = useLiveQuery(() => repo.listGoals(), []);
  const counts = useLiveQuery(() => repo.goalCounts(), []);
  const weak = useLiveQuery(() => repo.goalWeakSpots(3), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const active = goals?.find((g) => g.status === 'active');

  async function create(v: { title: string; why: string; activate: boolean }) {
    if (v.activate && active && !confirm(`Make this your active goal? "${active.title}" will be archived.`)) return;
    await repo.createGoal({ title: v.title, why: v.why }, { activate: v.activate });
  }

  async function activate(g: Goal) {
    if (active && !confirm(`Make "${g.title}" your active goal? "${active.title}" will be archived.`)) return;
    await repo.activateGoal(g.id);
  }

  if (!goals) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1>Goals</h1>
        <p className="hint">One active goal at a time. Depth over breadth.</p>
      </header>

      <section className="panel">
        <h2 className="mb-3">New goal</h2>
        <GoalForm submitLabel="Create goal" onSubmit={create} showActivate />
      </section>

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet">Create one above. Every video you log can be tied to it.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const c = counts?.[g.id] ?? { videos: 0, cards: 0, actionsDone: 0 };
            const isActive = g.status === 'active';
            return (
              <li key={g.id} className={`panel ${isActive ? 'border-primary/50' : ''}`}>
                {editingId === g.id ? (
                  <GoalForm
                    initial={g}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (v) => {
                      await repo.updateGoal(g.id, { title: v.title, why: v.why });
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{g.title}</p>
                        {g.why && <p className="text-sm text-fg-muted">{g.why}</p>}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-2 text-fg-muted'
                        }`}
                      >
                        {isActive ? 'Active' : 'Archived'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-fg-muted">
                      {c.videos} {c.videos === 1 ? 'video' : 'videos'} · {c.cards} {c.cards === 1 ? 'card' : 'cards'} · {c.actionsDone} {c.actionsDone === 1 ? 'action' : 'actions'} done
                    </p>
                    {weak?.[g.id] && (
                      <div className="mt-3 rounded-control bg-surface-2 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Weak spots</p>
                        <ul className="mt-1 space-y-1">
                          {weak[g.id].map((card) => (
                            <li key={card.id} className="flex items-baseline justify-between gap-3 text-sm">
                              <Link to={`/video/${card.videoId}`} className="min-w-0 truncate hover:text-link hover:underline">
                                {card.cue}
                              </Link>
                              <span className="shrink-0 text-xs font-semibold text-danger">forgot {card.lapses}×</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost" onClick={() => setEditingId(g.id)}>
                        Edit
                      </button>
                      {c.videos > 0 && (
                        <Link to={`/library?goal=${g.id}`} className="btn-ghost">
                          Videos
                        </Link>
                      )}
                      {isActive ? (
                        <button type="button" className="btn-ghost" onClick={() => repo.archiveGoal(g.id)}>
                          Archive
                        </button>
                      ) : (
                        <button type="button" className="btn-secondary" onClick={() => activate(g)}>
                          Make active
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
