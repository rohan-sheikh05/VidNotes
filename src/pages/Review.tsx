import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from '../db/repo';
import type { Card, Rating, Video } from '../db/types';
import { Ellipsis, Flame, Layers, PartyPopper } from 'lucide-react';
import ReviewCard from '../components/ReviewCard';
import CardEditor, { type CardDraft } from '../components/CardEditor';
import EmptyState from '../components/EmptyState';
import { now } from '../lib/dates';
import { RATINGS } from '../lib/scheduler';
import { retention, reviewStreak } from '../lib/stats';

interface Session {
  queue: Card[]; // snapshot taken at start; "Forgot" cards are appended again
  pos: number;
  ratings: Rating[];
  reviewedIds: Set<string>;
}

export default function Review() {
  const [session, setSession] = useState<Session | null>(null);
  const [videos, setVideos] = useState<Record<string, Video>>({});
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<CardDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Snapshot the queue once, so cards don't shuffle while reviewing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await repo.getSettings();
      const queue = await repo.getReviewQueue(settings.dailyReviewLimit);
      const vids = await repo.getVideos([...new Set(queue.map((c) => c.videoId))]);
      if (cancelled) return;
      setVideos(Object.fromEntries(vids.filter((v): v is Video => !!v).map((v) => [v.id, v])));
      setSession({ queue, pos: 0, ratings: [], reviewedIds: new Set() });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const card = session && session.pos < session.queue.length ? session.queue[session.pos] : undefined;

  const resetCardUi = () => {
    setRevealed(false);
    setTyped('');
    setMenuOpen(false);
    setEditing(null);
    setError(null);
  };

  const rate = useCallback(
    async (rating: Rating) => {
      if (!session || !card || busy) return;
      setBusy(true);
      try {
        const updated = await repo.reviewCard(card.id, rating);
        setSession((s) => {
          if (!s) return s;
          const queue = rating === 'again' ? [...s.queue, updated] : s.queue;
          const reviewedIds = new Set(s.reviewedIds).add(card.id);
          return { queue, pos: s.pos + 1, ratings: [...s.ratings, rating], reviewedIds };
        });
        resetCardUi();
      } finally {
        setBusy(false);
      }
    },
    [session, card, busy],
  );

  // Keyboard: Space reveals, 1–4 rate. Ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]') || editing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!card) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        rate(RATINGS[Number(e.key) - 1]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, rate, editing]);

  /** Remove every remaining occurrence of the current card from the queue (after suspend/delete). */
  function dropCurrent() {
    if (!card) return;
    setSession((s) => {
      if (!s) return s;
      const before = s.queue.slice(0, s.pos);
      const after = s.queue.slice(s.pos).filter((c) => c.id !== card.id);
      return { ...s, queue: [...before, ...after] };
    });
    resetCardUi();
  }

  async function saveEdit() {
    if (!card || !editing) return;
    try {
      await repo.updateCard(card.id, editing);
      setSession((s) =>
        s ? { ...s, queue: s.queue.map((c) => (c.id === card.id ? { ...c, cue: editing.cue.trim(), answer: editing.answer.trim() } : c)) } : s,
      );
      setEditing(null);
      setMenuOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!session) return null;

  if (session.queue.length === 0) {
    return (
      <div className="space-y-4">
        <h1>Review</h1>
        <EmptyState
          icon={Layers}
          title="No reviews due"
          action={
            <Link to="/video/new" className="btn-primary">
              Log a video
            </Link>
          }
        >
          Log a video and write takeaways to start building memory. New cards show up here the next day.
        </EmptyState>
      </div>
    );
  }

  if (!card) return <SessionDone session={session} />;

  const remaining = session.queue.length - session.pos;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1>Review</h1>
        <div className="flex items-center gap-2">
          <span className="hint">{remaining} left</span>
          <div className="relative">
            <button type="button" className="btn-ghost btn-icon" aria-label="Card menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Ellipsis size={20} aria-hidden />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-control border border-border-strong bg-surface">
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left hover:bg-surface-2"
                  onClick={() => {
                    setEditing({ cue: card.cue, answer: card.answer });
                    setMenuOpen(false);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left hover:bg-surface-2"
                  onClick={async () => {
                    await repo.setCardSuspended(card.id, true);
                    dropCurrent();
                  }}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-danger hover:bg-surface-2"
                  onClick={async () => {
                    if (!confirm('Delete this card and its review history?')) return;
                    await repo.deleteCard(card.id);
                    dropCurrent();
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(session.pos / session.queue.length) * 100}%` }} />
      </div>

      {editing ? (
        <div className="space-y-3">
          <CardEditor value={editing} onChange={setEditing} autoFocus />
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={saveEdit}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ReviewCard
          key={`${card.id}-${session.pos}`}
          card={card}
          video={videos[card.videoId]}
          revealed={revealed}
          typed={typed}
          onType={setTyped}
          onReveal={() => setRevealed(true)}
          onRate={rate}
        />
      )}
    </div>
  );
}

function SessionDone({ session }: { session: Session }) {
  const allReviews = useLiveQuery(() => repo.listAllReviews(), []);
  const ret = retention(session.ratings.map((rating) => ({ rating })));
  const streak = allReviews ? reviewStreak(allReviews, now()) : undefined;

  return (
    <div className="flex flex-col items-center space-y-6 text-center">
      <span className="flex flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-on-primary-soft"><PartyPopper size={32} aria-hidden /></span>
      <h1>Session complete</h1>
      <div className="grid w-full grid-cols-3 gap-2">
        <Stat label="Cards reviewed" value={String(session.reviewedIds.size)} />
        <Stat label="Retention" value={ret === null ? '—' : `${Math.round(ret * 100)}%`} />
        <Stat label="Day streak" value={streak === undefined ? '…' : String(streak)} accent />
      </div>
      <Link to="/" className="btn-primary">
        Back to Today
      </Link>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel px-2">
      <p className={`inline-flex items-center gap-1 text-3xl font-extrabold tabular-nums ${accent ? 'text-accent' : ''}`}>
        {accent && <Flame size={22} aria-hidden />}
        {value}
      </p>
      <p className="hint mt-0.5 text-xs font-medium">{label}</p>
    </div>
  );
}
