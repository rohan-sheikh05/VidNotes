import { Trash2 } from 'lucide-react';

export interface CardDraft {
  cue: string;
  answer: string;
}

/** One cue/answer pair. Used by the Log wizard and the card edit form. */
export default function CardEditor({
  value,
  onChange,
  index,
  onRemove,
  autoFocus,
}: {
  value: CardDraft;
  onChange: (v: CardDraft) => void;
  index?: number;
  onRemove?: () => void;
  autoFocus?: boolean;
}) {
  const n = index !== undefined ? index + 1 : undefined;
  const key = n ?? 'x';
  return (
    <div className="panel space-y-3">
      <div className="flex min-h-[44px] items-center justify-between">
        <p className="eyebrow">{n ? `Takeaway ${n}` : 'Card'}</p>
        {onRemove && (
          <button type="button" className="btn-icon text-fg-muted hover:bg-danger-soft hover:text-on-danger-soft" onClick={onRemove} aria-label={`Remove takeaway ${n ?? ''}`}>
            <Trash2 size={18} aria-hidden />
          </button>
        )}
      </div>
      <div>
        <label className="label" htmlFor={`cue-${key}`}>
          Cue <span className="font-normal text-fg-muted">— a question</span>
        </label>
        <input
          id={`cue-${key}`}
          className="input"
          placeholder="What is a list comprehension?"
          value={value.cue}
          autoFocus={autoFocus}
          onChange={(e) => onChange({ ...value, cue: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor={`answer-${key}`}>
          Answer <span className="font-normal text-fg-muted">— in your own words</span>
        </label>
        <textarea
          id={`answer-${key}`}
          className="input min-h-[88px]"
          value={value.answer}
          onChange={(e) => onChange({ ...value, answer: e.target.value })}
        />
      </div>
    </div>
  );
}
