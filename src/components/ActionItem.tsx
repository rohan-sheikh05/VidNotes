import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Play } from 'lucide-react';
import type { Action, Video } from '../db/types';
import * as repo from '../db/repo';
import { formatDate, relativeDay, today } from '../lib/dates';

/**
 * A checkbox row for an action. Ticking it asks for an optional one-line reflection
 * ("What happened when you tried it?") before marking it done.
 */
export default function ActionItem({ action, video }: { action: Action; video?: Video }) {
  const [reflecting, setReflecting] = useState(false);
  const [reflection, setReflection] = useState('');
  const done = !!action.doneAt;
  const overdue = !done && action.dueDate < today();
  const dueToday = !done && action.dueDate === today();
  const checked = done || reflecting;

  async function finish() {
    await repo.completeAction(action.id, reflection);
    setReflecting(false);
    setReflection('');
  }

  return (
    <li className={`panel ${overdue ? 'border-danger/50' : ''}`}>
      <div className="flex items-start gap-1">
        {/* 44px hit area around a 24px visual checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={done ? `Mark "${action.text}" as not done` : `Mark "${action.text}" as done`}
          className="-ml-2.5 -mt-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control"
          onClick={() => (done ? repo.reopenAction(action.id) : setReflecting((r) => !r))}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
              checked ? 'border-primary bg-primary text-on-primary' : 'border-border-strong bg-surface'
            }`}
          >
            {checked && <Check size={16} strokeWidth={3} aria-hidden />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${done ? 'text-fg-muted line-through' : ''}`}>{action.text}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {done ? (
              <span className="text-fg-muted">Done {formatDate(action.doneAt!)}</span>
            ) : (
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  overdue
                    ? 'bg-danger-soft text-on-danger-soft'
                    : dueToday
                      ? 'bg-accent-soft text-on-accent-soft'
                      : 'bg-surface-2 text-fg-muted'
                }`}
              >
                {overdue ? 'Overdue · ' : 'Due '}
                {relativeDay(action.dueDate)} · {formatDate(action.dueDate)}
              </span>
            )}
            {video && (
              <Link to={`/video/${video.id}`} className="inline-flex min-w-0 items-center gap-1 text-fg-muted hover:text-link hover:underline">
                <Play size={12} aria-hidden className="shrink-0" />
                <span className="truncate">{video.title}</span>
              </Link>
            )}
          </p>
          {action.reflection && (
            <p className="mt-2 border-l-2 border-border-strong pl-3 text-sm italic text-fg-muted">{action.reflection}</p>
          )}
        </div>
      </div>

      {reflecting && !done && (
        <form
          className="mt-3 space-y-3 sm:pl-9"
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          <div>
            <label className="label" htmlFor={`refl-${action.id}`}>
              What happened when you tried it? <span className="font-normal text-fg-muted">(optional)</span>
            </label>
            <input id={`refl-${action.id}`} className="input" autoFocus value={reflection} onChange={(e) => setReflection(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              <Check size={18} aria-hidden /> Mark done
            </button>
            <button type="button" className="btn-ghost" onClick={() => setReflecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
