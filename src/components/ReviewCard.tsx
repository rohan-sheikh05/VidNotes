import { Link } from 'react-router-dom';
import { Eye, Play } from 'lucide-react';
import type { Card, Rating, Video } from '../db/types';
import { previewIntervals, RATINGS } from '../lib/scheduler';
import { formatInterval } from '../lib/dates';

const LABEL: Record<Rating, string> = { again: 'Forgot', hard: 'Hard', good: 'Good', easy: 'Easy' };
// Soft tinted buttons: the label carries the meaning, colour only reinforces it.
const STYLE: Record<Rating, string> = {
  again: 'bg-danger-soft text-on-danger-soft hover:border-on-danger-soft/40',
  hard: 'bg-warning-soft text-on-warning-soft hover:border-on-warning-soft/40',
  good: 'bg-success-soft text-on-success-soft hover:border-on-success-soft/40',
  easy: 'bg-info-soft text-on-info-soft hover:border-on-info-soft/40',
};

export default function ReviewCard({
  card,
  video,
  revealed,
  typed,
  onType,
  onReveal,
  onRate,
}: {
  card: Card;
  video?: Video;
  revealed: boolean;
  typed: string;
  onType: (s: string) => void;
  onReveal: () => void;
  onRate: (r: Rating) => void;
}) {
  const preview = previewIntervals(card);

  return (
    <div className="space-y-4">
      <section className="panel flex min-h-[160px] flex-col justify-center p-6" aria-label="Question">
        <p className="eyebrow">Question</p>
        <p className="mt-2 whitespace-pre-wrap text-xl font-bold leading-snug">{card.cue}</p>
      </section>

      {!revealed ? (
        <>
          <div>
            <label className="label" htmlFor="typed">
              Type your answer <span className="font-normal text-fg-muted">(recommended)</span>
            </label>
            <textarea id="typed" className="input min-h-[96px]" value={typed} onChange={(e) => onType(e.target.value)} />
          </div>
          <button type="button" className="btn-primary w-full py-3 text-lg" onClick={onReveal}>
            <Eye size={20} aria-hidden /> Show answer
            <kbd className="ml-1 hidden sm:inline">Space</kbd>
          </button>
        </>
      ) : (
        <>
          {typed.trim() && (
            <section className="rounded-card border border-dashed border-border-strong/60 p-4" aria-label="Your answer">
              <p className="eyebrow">You wrote</p>
              <p className="mt-1 whitespace-pre-wrap">{typed}</p>
            </section>
          )}
          <section className="panel border-l-4 border-l-accent" aria-label="Answer" aria-live="polite">
            <p className="eyebrow">Answer</p>
            <p className="mt-1 whitespace-pre-wrap text-lg">{card.answer}</p>
            {video && (
              <Link
                to={`/video/${video.id}`}
                className="mt-3 inline-flex min-h-[44px] max-w-full items-center gap-1.5 text-sm font-medium text-link hover:underline"
              >
                <Play size={14} aria-hidden className="shrink-0" />
                <span className="truncate">{video.title}</span>
              </Link>
            )}
          </section>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember?">
            {RATINGS.map((r, i) => (
              <button
                key={r}
                type="button"
                className={`btn min-h-[64px] flex-col gap-0.5 rounded-card border border-transparent px-1 ${STYLE[r]}`}
                onClick={() => onRate(r)}
                aria-label={`${LABEL[r]}, next review in ${formatInterval(preview[r])}`}
              >
                <span>{LABEL[r]}</span>
                <span className="text-xs font-medium tabular-nums opacity-80">
                  {formatInterval(preview[r])}
                  <span className="hidden sm:inline"> · {i + 1}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
