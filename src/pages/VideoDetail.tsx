import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Pause, Pencil, Play, Plus, Star, Trash2 } from 'lucide-react';
import * as repo from '../db/repo';
import type { Card } from '../db/types';
import EditableField from '../components/EditableField';
import TimestampNoteList from '../components/TimestampNoteList';
import ActionItem from '../components/ActionItem';
import CardEditor, { type CardDraft } from '../components/CardEditor';
import { formatDate, formatInterval, relativeDay } from '../lib/dates';

function CardRow({ card }: { card: Card }) {
  const [editing, setEditing] = useState<CardDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <li className="space-y-2 py-3">
        <CardEditor value={editing} onChange={setEditing} autoFocus />
        {error && <p className="error-text">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              try {
                await repo.updateCard(card.id, editing);
                setEditing(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Save
          </button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{card.cue}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-fg-muted">{card.answer}</p>
        <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-fg-muted">
          {card.suspended ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold">Suspended</span>
          ) : (
            <span>Next review {relativeDay(card.due)}</span>
          )}
          {card.reps > 0 && <span>· interval {formatInterval(card.intervalDays)}</span>}
          {card.lapses > 0 && <span className="font-semibold text-danger">· forgot {card.lapses}×</span>}
        </p>
      </div>
      <div className="flex shrink-0">
        <button type="button" className="btn-ghost btn-icon" aria-label="Edit card" onClick={() => setEditing({ cue: card.cue, answer: card.answer })}>
          <Pencil size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="btn-ghost btn-icon"
          aria-label={card.suspended ? 'Resume reviewing this card' : 'Suspend this card'}
          aria-pressed={card.suspended}
          onClick={() => repo.setCardSuspended(card.id, !card.suspended)}
        >
          {card.suspended ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
        </button>
        <button
          type="button"
          className="btn-ghost btn-icon hover:bg-danger-soft hover:text-on-danger-soft"
          aria-label="Delete card"
          onClick={() => confirm('Delete this card and its review history?') && repo.deleteCard(card.id)}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export default function VideoDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getVideoBundle(id), [id]);
  const goals = useLiveQuery(() => repo.listGoals(), []);
  const [newCard, setNewCard] = useState<CardDraft | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  if (bundle === undefined) return null;
  if (bundle === null)
    return (
      <div className="space-y-3">
        <h1>Video not found</h1>
        <Link to="/library" className="btn-secondary">
          Back to Library
        </Link>
      </div>
    );

  const { video: v, notes, cards, actions } = bundle;
  const logged = v.status === 'logged';

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link to={`/video/${v.id}/watch`} className="relative block overflow-hidden rounded-card bg-surface-2" aria-label={`Watch ${v.title}`}>
          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white">
              <Play size={26} aria-hidden className="ml-1 fill-current" />
            </span>
          </span>
        </Link>
        <EditableField hideLabel label="Title" value={v.title} onSave={(title) => repo.updateVideo(v.id, { title })} display={<h1 className="text-xl leading-snug">{v.title}</h1>} />
        <p className="text-sm text-fg-muted">
          {[v.channel, logged && v.loggedAt ? `Logged ${formatDate(v.loggedAt)}` : 'Not logged yet'].filter(Boolean).join(' · ')}
        </p>
        <div className="flex flex-wrap gap-2">
          {!logged && (
            <Link to={`/video/${v.id}/log`} className="btn-primary">
              Finish log
            </Link>
          )}
          <Link to={`/video/${v.id}/watch`} className={logged ? 'btn-primary' : 'btn-secondary'}>
            <Play size={18} aria-hidden /> Watch
          </Link>
          <a href={v.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <ExternalLink size={18} aria-hidden /> YouTube
          </a>
        </div>
      </header>

      <section className="panel space-y-4">
        <EditableField label="Purpose" value={v.purpose} onSave={(purpose) => repo.updateVideo(v.id, { purpose })} />
        <div className="border-t border-border pt-3">
          <label className="label" htmlFor="vd-goal">
            Goal
          </label>
          <select
            id="vd-goal"
            className="input"
            value={v.goalId ?? ''}
            onChange={(e) => repo.updateVideo(v.id, { goalId: e.target.value || null })}
          >
            <option value="">No goal</option>
            {goals?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
                {g.status === 'archived' ? ' (archived)' : ''}
              </option>
            ))}
          </select>
          <p className="hint mt-1 text-xs">Its cards and action move with it.</p>
        </div>
        <fieldset className="border-t border-border pt-3">
          <legend className="label pt-3">Usefulness</legend>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`btn-icon btn ${v.rating && r <= v.rating ? 'text-accent' : 'text-fg-muted'} hover:bg-surface-2`}
                aria-label={`${r} star${r === 1 ? '' : 's'}`}
                aria-pressed={v.rating === r}
                onClick={() => repo.updateVideo(v.id, { rating: v.rating === r ? null : r })}
              >
                <Star size={20} aria-hidden className={v.rating && r <= v.rating ? 'fill-current' : ''} />
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {logged && (
        <section className="panel">
          <EditableField
            label="Brain dump"
            value={v.brainDump ?? ''}
            multiline
            onSave={(brainDump) => repo.updateVideo(v.id, { brainDump })}
            empty="No brain dump."
          />
        </section>
      )}

      <section className="panel" aria-labelledby="vd-cards">
        <div className="flex items-center justify-between">
          <h2 id="vd-cards" className="text-base">
            Takeaways <span className="font-normal text-fg-muted">· {cards.length}</span>
          </h2>
          {logged && !newCard && (
            <button type="button" className="btn-ghost" onClick={() => setNewCard({ cue: '', answer: '' })}>
              <Plus size={16} aria-hidden /> Add
            </button>
          )}
        </div>
        {cards.length === 0 && !newCard && <p className="hint">{logged ? 'No cards.' : 'Cards are created when you finish the log.'}</p>}
        <ul className="divide-y divide-border">
          {cards.map((c) => (
            <CardRow key={c.id} card={c} />
          ))}
        </ul>
        {newCard && (
          <div className="mt-2 space-y-2">
            <CardEditor value={newCard} onChange={setNewCard} autoFocus />
            {cardError && <p className="error-text">{cardError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  try {
                    await repo.addCard(v.id, newCard);
                    setNewCard(null);
                    setCardError(null);
                  } catch (e) {
                    setCardError((e as Error).message);
                  }
                }}
              >
                Add card
              </button>
              <button type="button" className="btn-ghost" onClick={() => setNewCard(null)}>
                Cancel
              </button>
            </div>
            <p className="hint text-xs">First review tomorrow.</p>
          </div>
        )}
      </section>

      {actions.length > 0 && (
        <section aria-labelledby="vd-actions">
          <h2 id="vd-actions" className="mb-2 text-base">
            Action
          </h2>
          <ul className="space-y-2">
            {actions.map((a) => (
              <ActionItem key={a.id} action={a} />
            ))}
          </ul>
        </section>
      )}

      <section className="panel" aria-labelledby="vd-notes">
        <h2 id="vd-notes" className="mb-1 text-base">
          Timestamp notes <span className="font-normal text-fg-muted">· {notes.length}</span>
        </h2>
        <TimestampNoteList
          notes={notes}
          onSeek={(t) => navigate(`/video/${v.id}/watch?t=${Math.floor(t)}`)}
          onEdit={(nid, patch) => repo.updateNote(nid, patch)}
          onDelete={(nid) => repo.deleteNote(nid)}
        />
      </section>

      <section className="panel">
        <EditableField
          label="Open questions"
          value={v.openQuestions.join('\n')}
          multiline
          hint="One question per line."
          onSave={(q) => repo.updateVideo(v.id, { openQuestions: q.split('\n') })}
          empty="No open questions."
          display={
            v.openQuestions.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {v.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : undefined
          }
        />
      </section>

      <section className="border-t border-border pt-4">
        <button
          type="button"
          className="btn-ghost text-danger hover:bg-danger-soft hover:text-on-danger-soft"
          onClick={async () => {
            if (!confirm(`Delete "${v.title}" with its notes, cards, reviews and action? This can't be undone.`)) return;
            await repo.deleteVideo(v.id);
            navigate('/library');
          }}
        >
          <Trash2 size={18} aria-hidden /> Delete video
        </button>
      </section>
    </div>
  );
}
