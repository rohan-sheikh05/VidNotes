import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import type { TimestampNote } from '../db/types';
import { formatTimestamp, parseTimestamp } from '../lib/youtube';

interface Props {
  notes: TimestampNote[];
  /** Makes timestamps clickable (seek the player). */
  onSeek?: (t: number) => void;
  /** Enables inline edit / delete. */
  onEdit?: (id: string, patch: { t: number; text: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function TimestampNoteList({ notes, onSeek, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState<{ id: string; time: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (notes.length === 0) return <p className="hint">No timestamp notes for this video.</p>;

  async function save() {
    if (!editing || !onEdit) return;
    const t = parseTimestamp(editing.time);
    if (t === null) return setError('Use a time like 1:05 or 1:02:03.');
    try {
      await onEdit(editing.id, { t, text: editing.text });
      setEditing(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <ul className="divide-y divide-border">
      {notes.map((n) =>
        editing?.id === n.id ? (
          <li key={n.id} className="py-2">
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="sr-only" htmlFor={`nt-${n.id}`}>
                Time
              </label>
              <input
                id={`nt-${n.id}`}
                className="input w-24 font-mono tabular-nums"
                value={editing.time}
                onChange={(e) => setEditing({ ...editing, time: e.target.value })}
              />
              <label className="sr-only" htmlFor={`nx-${n.id}`}>
                Note
              </label>
              <input
                id={`nx-${n.id}`}
                className="input min-w-0 flex-1"
                autoFocus
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
              />
              <button type="submit" className="btn-icon btn-ghost" aria-label="Save note">
                <Check size={18} aria-hidden />
              </button>
              <button type="button" className="btn-icon btn-ghost" aria-label="Cancel editing" onClick={() => setEditing(null)}>
                <X size={18} aria-hidden />
              </button>
            </form>
            {error && <p className="error-text mt-1">{error}</p>}
          </li>
        ) : (
          <li key={n.id} className="group flex items-start gap-3 py-1.5 text-sm">
            {onSeek ? (
              <button
                type="button"
                className="min-h-[44px] shrink-0 rounded-control px-1 font-mono font-semibold tabular-nums text-link hover:underline"
                onClick={() => onSeek(n.t)}
                aria-label={`Jump to ${formatTimestamp(n.t)}`}
              >
                {formatTimestamp(n.t)}
              </button>
            ) : (
              <span className="shrink-0 py-0.5 font-mono tabular-nums text-fg-muted">{formatTimestamp(n.t)}</span>
            )}
            <span className={`min-w-0 flex-1 whitespace-pre-wrap ${onSeek ? 'py-3' : 'py-0.5'}`}>{n.text}</span>
            {(onEdit || onDelete) && (
              <span className="flex shrink-0">
                {onEdit && (
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    aria-label={`Edit note at ${formatTimestamp(n.t)}`}
                    onClick={() => {
                      setError(null);
                      setEditing({ id: n.id, time: formatTimestamp(n.t), text: n.text });
                    }}
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="btn-icon btn-ghost hover:bg-danger-soft hover:text-on-danger-soft"
                    aria-label={`Delete note at ${formatTimestamp(n.t)}`}
                    onClick={() => onDelete(n.id)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </span>
            )}
          </li>
        ),
      )}
    </ul>
  );
}
