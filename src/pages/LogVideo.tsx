import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from '../db/repo';
import CardEditor, { type CardDraft } from '../components/CardEditor';
import TimestampNoteList from '../components/TimestampNoteList';
import { ArrowLeft, Check, CircleCheck, Plus } from 'lucide-react';
import GoalBadge from '../components/GoalBadge';
import { dayStartPlus, formatDate, fromDateInput, now, relativeDay, toDateInput } from '../lib/dates';

type Step = 1 | 2 | 3 | 4;
const STEP_TITLES = ['Brain dump', 'Takeaways', 'Action', 'Questions & rating'];

interface Draft {
  step: Step;
  brainDump: string;
  takeaways: CardDraft[];
  actionText: string;
  actionDue: string; // yyyy-MM-dd
  questions: string;
  rating?: 1 | 2 | 3 | 4 | 5;
}

const draftKey = (id: string) => `vidnotes:logdraft:${id}`;

function loadDraft(id: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export default function LogVideo() {
  const { id = '' } = useParams();
  const video = useLiveQuery(() => repo.getVideo(id).then((v) => v ?? null), [id]);
  const notes = useLiveQuery(() => repo.listNotes(id), [id]);
  const goal = useLiveQuery(async () => (video?.goalId ? repo.getGoal(video.goalId) : undefined), [video?.goalId]);

  const [draft, setDraft] = useState<Draft>(
    () =>
      loadDraft(id) ?? {
        step: 1,
        brainDump: '',
        takeaways: [{ cue: '', answer: '' }],
        actionText: '',
        actionDue: toDateInput(dayStartPlus(now(), 2)),
        questions: '',
      },
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cardCount: number; firstDue: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep an in-progress draft so an accidental navigation doesn't lose the brain dump.
  useEffect(() => {
    if (result) return;
    try {
      sessionStorage.setItem(draftKey(id), JSON.stringify(draft));
    } catch {
      /* storage unavailable: fine */
    }
  }, [draft, id, result]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  if (video === undefined || notes === undefined) return null;
  if (video === null)
    return (
      <div className="space-y-3">
        <h1>Video not found</h1>
        <Link to="/" className="btn-secondary">
          Back to Today
        </Link>
      </div>
    );

  if (result) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-on-primary-soft"><CircleCheck size={32} aria-hidden /></span>
        <h1>Logged</h1>
        <p className="text-lg">
          {result.cardCount} {result.cardCount === 1 ? 'card' : 'cards'} scheduled · first review {relativeDay(result.firstDue)}
        </p>
        <p className="hint">Now go do the action. That's where learning turns into skill.</p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Link to="/" className="btn-primary">
            Back to Today
          </Link>
          <Link to="/video/new" className="btn-secondary">
            Log another video
          </Link>
        </div>
      </div>
    );
  }

  if (video.status === 'logged') {
    return (
      <div className="space-y-3">
        <h1>{video.title}</h1>
        <p>This video is already logged.</p>
        <Link to="/" className="btn-secondary">
          Back to Today
        </Link>
      </div>
    );
  }

  const step = draft.step;
  const brainDumpOk = draft.brainDump.trim().length >= repo.MIN_BRAIN_DUMP;
  const completeTakeaways = draft.takeaways.filter((t) => t.cue.trim() && t.answer.trim());
  const partialTakeaway = draft.takeaways.some((t) => !!t.cue.trim() !== !!t.answer.trim());
  const takeawaysOk = completeTakeaways.length >= 1 && !partialTakeaway;
  const actionOk = draft.actionText.trim().length > 0 && !!draft.actionDue;

  const canNext = step === 1 ? brainDumpOk : step === 2 ? takeawaysOk : step === 3 ? actionOk : true;

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await repo.logVideo(id, {
        brainDump: draft.brainDump,
        takeaways: draft.takeaways,
        action: { text: draft.actionText, dueDate: fromDateInput(draft.actionDue) },
        openQuestions: draft.questions.split('\n'),
        rating: draft.rating,
      });
      try {
        sessionStorage.removeItem(draftKey(id));
      } catch {
        /* ignore */
      }
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!canNext) return;
    if (step < 4) set({ step: (step + 1) as Step });
    else submit();
  }

  const showCompare = step > 1;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link to={`/video/${id}/watch`} className="-ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium text-link hover:underline">
          <ArrowLeft size={16} aria-hidden /> Back to the video
        </Link>
        <p className="hint truncate">{video.title}</p>
        <GoalBadge goal={goal} />
        <p className="text-sm">
          <span className="font-semibold">Purpose:</span> {video.purpose}
        </p>
      </header>

      {/* Step indicator */}
      <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
        {STEP_TITLES.map((t, i) => (
          <li key={t} className="space-y-1">
            <div className={`h-1.5 rounded-full ${i < step ? 'bg-accent' : 'bg-surface-2'}`} />
            <p className={`hidden text-xs sm:block ${i + 1 === step ? 'font-semibold text-fg' : 'text-fg-muted'}`}>{t}</p>
          </li>
        ))}
      </ol>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {step === 1 && (
          <section className="space-y-2">
            <h1 className="text-xl">Without looking, write everything you remember.</h1>
            <p className="hint">Messy is fine. Trying to recall is what makes it stick. Your notes appear after this step.</p>
            <textarea
              className="input min-h-[220px]"
              autoFocus
              value={draft.brainDump}
              onChange={(e) => set({ brainDump: e.target.value })}
            />
            <p className="text-xs text-fg-muted">
              {brainDumpOk ? <span className="inline-flex items-center gap-1 font-semibold text-on-success-soft"><Check size={14} aria-hidden /> Enough to continue</span> : `${draft.brainDump.trim().length}/${repo.MIN_BRAIN_DUMP} characters minimum`}
            </p>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <h1 className="text-xl">Takeaways → review cards</h1>
            <p className="hint">Write the cue as a question you'd want to be asked in a week.</p>
            {draft.takeaways.map((t, i) => (
              <CardEditor
                key={i}
                index={i}
                autoFocus={i === 0}
                value={t}
                onChange={(v) => set({ takeaways: draft.takeaways.map((x, j) => (j === i ? v : x)) })}
                onRemove={draft.takeaways.length > 1 ? () => set({ takeaways: draft.takeaways.filter((_, j) => j !== i) }) : undefined}
              />
            ))}
            {draft.takeaways.length < repo.MAX_TAKEAWAYS && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => set({ takeaways: [...draft.takeaways, { cue: '', answer: '' }] })}
              >
                <Plus size={18} aria-hidden /> Add takeaway
              </button>
            )}
            {partialTakeaway && <p className="text-sm font-medium text-on-warning-soft">Each takeaway needs both a cue and an answer.</p>}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <h1 className="text-xl">One concrete action</h1>
            <p className="hint">Something small you'll actually do to apply this. "Write a script that cleans my CSV with pandas."</p>
            <div>
              <label className="label" htmlFor="action">
                Action
              </label>
              <input
                id="action"
                className="input"
                autoFocus
                value={draft.actionText}
                onChange={(e) => set({ actionText: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="due">
                Due date
              </label>
              <input
                id="due"
                type="date"
                className="input"
                value={draft.actionDue}
                min={toDateInput(now())}
                onChange={(e) => set({ actionDue: e.target.value })}
              />
              {draft.actionDue && <p className="hint mt-1">{formatDate(fromDateInput(draft.actionDue))}</p>}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h1 className="text-xl">Questions & rating</h1>
            <div>
              <label className="label" htmlFor="questions">
                Open questions <span className="font-normal text-fg-muted">(optional, one per line)</span>
              </label>
              <textarea
                id="questions"
                className="input min-h-[100px]"
                value={draft.questions}
                onChange={(e) => set({ questions: e.target.value })}
              />
            </div>
            <fieldset>
              <legend className="label">How useful was this video?</legend>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={draft.rating === r}
                    className={`btn h-12 w-12 border ${
                      draft.rating === r
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-strong bg-surface hover:bg-surface-2'
                    }`}
                    onClick={() => set({ rating: draft.rating === r ? undefined : r })}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="flex gap-2">
          {step > 1 && (
            <button type="button" className="btn-secondary" onClick={() => set({ step: (step - 1) as Step })}>
              Back
            </button>
          )}
          <button type="submit" className="btn-primary flex-1" disabled={!canNext || saving}>
            {step === 1 ? 'Submit & compare with notes' : step < 4 ? 'Next' : saving ? 'Saving…' : 'Save log'}
          </button>
        </div>
      </form>

      {/* Revealed only after the brain dump is submitted. */}
      {showCompare && (
        <aside className="space-y-4">
          {notes.length > 0 && (
            <details open={step === 2} className="panel">
              <summary className="cursor-pointer font-semibold">Your timestamp notes ({notes.length})</summary>
              <div className="mt-3">
                <TimestampNoteList notes={notes} />
              </div>
            </details>
          )}
          <details className="panel">
            <summary className="cursor-pointer font-semibold">Your brain dump</summary>
            <p className="mt-3 whitespace-pre-wrap text-sm">{draft.brainDump}</p>
          </details>
        </aside>
      )}
    </div>
  );
}
