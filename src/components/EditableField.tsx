import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';

/**
 * Shows a value with an Edit button; editing swaps in an input/textarea with Save and Cancel.
 * Errors from `onSave` are shown under the field.
 */
export default function EditableField({
  label,
  value,
  onSave,
  multiline,
  placeholder,
  empty = 'Nothing yet.',
  display,
  hint,
  hideLabel,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  empty?: string;
  display?: ReactNode;
  hint?: string;
  /** Show only the value + edit button (the label is still announced to screen readers). */
  hideLabel?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = `ef-${label.replace(/\W+/g, '-').toLowerCase()}`;

  async function save() {
    try {
      await onSave(draft ?? '');
      setDraft(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (draft !== null) {
    return (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor={id} className="label">
          {label}
        </label>
        {multiline ? (
          <textarea id={id} className="input min-h-[120px]" autoFocus value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
        ) : (
          <input id={id} className="input" autoFocus value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
        )}
        {hint && <p className="hint text-xs">{hint}</p>}
        {error && <p className="error-text">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Save
          </button>
          <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (hideLabel) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">{display ?? <p>{value}</p>}</div>
        <button type="button" className="btn-ghost btn-icon shrink-0" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => setDraft(value)}>
          <Pencil size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base">{label}</h2>
        <button type="button" className="btn-ghost btn-icon" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => setDraft(value)}>
          <Pencil size={16} aria-hidden />
        </button>
      </div>
      {display ?? (value.trim() ? <p className="whitespace-pre-wrap">{value}</p> : <p className="hint">{empty}</p>)}
    </div>
  );
}
