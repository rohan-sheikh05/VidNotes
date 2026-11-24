import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, ExternalLink, MessageSquareText, Plus, Target, TriangleAlert } from 'lucide-react';
import * as repo from '../db/repo';
import YouTubePlayer, { type PlayerHandle } from '../components/YouTubePlayer';
import TimestampNoteList from '../components/TimestampNoteList';
import GoalBadge from '../components/GoalBadge';
import { formatTimestamp, parseTimestamp } from '../lib/youtube';
import { isPromptDue, isShortcutTarget, playbackDelta, PROMPT_INTERVAL_SEC, resumeAt } from '../lib/watch';

const SAVE_EVERY_SEC = 5;

export default function Watch() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  // Dev-only: `?promptEvery=5` shortens the pause-prompt interval for testing.
  const [params] = useSearchParams();
  const devEvery = import.meta.env.DEV ? Number(params.get('promptEvery')) : NaN;
  const promptInterval = devEvery > 0 ? devEvery : PROMPT_INTERVAL_SEC;
  const video = useLiveQuery(() => repo.getVideo(id).then((v) => v ?? null), [id]);
  const notes = useLiveQuery(() => repo.listNotes(id), [id]);
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const goal = useLiveQuery(async () => (video?.goalId ? repo.getGoal(video.goalId) : undefined), [video?.goalId]);

  const player = useRef<PlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Note composer (N / "+ Note")
  const [composer, setComposer] = useState<{ time: string; text: string; resume: boolean } | null>(null);
  const noteInput = useRef<HTMLInputElement>(null);
  // "Explain the last part" prompt every 10 minutes of playback
  const [prompt, setPrompt] = useState<{ text: string } | null>(null);
  const promptInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Start position is computed once, from the saved progress when the page opened.
  // `?t=<sec>` (from a note on the detail page) wins over the saved position.
  const jumpTo = Number(params.get('t'));
  const startAt = useMemo(
    () => (Number.isFinite(jumpTo) && jumpTo > 0 ? Math.floor(jumpTo) : video ? resumeAt(video.positionSec, video.durationSec) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [video?.id],
  );

  /* ---------------------------------------------------------------- progress + prompts */
  const played = useRef(0);
  const lastPromptAt = useRef(0);
  const lastTick = useRef(Date.now());
  const sinceSave = useRef(0);
  const overlayOpen = useRef(false);
  overlayOpen.current = !!composer || !!prompt;
  const promptsOn = settings?.pausePrompts ?? true;

  const saveProgress = useCallback(() => {
    const p = player.current;
    if (!p || !ready) return;
    const t = p.currentTime();
    if (t > 0) repo.saveWatchProgress(id, t, p.duration()).catch(() => undefined);
  }, [id, ready]);

  useEffect(() => {
    if (!ready) return;
    lastTick.current = Date.now();
    const timer = window.setInterval(() => {
      const p = player.current;
      const now = Date.now();
      const prev = lastTick.current;
      lastTick.current = now;
      if (!p || !p.isPlaying()) return;
      const d = playbackDelta(prev, now, p.playbackRate());
      played.current += d;
      sinceSave.current += d;
      if (sinceSave.current >= SAVE_EVERY_SEC) {
        sinceSave.current = 0;
        saveProgress();
      }
      if (promptsOn && !overlayOpen.current && isPromptDue(played.current, lastPromptAt.current, promptInterval)) {
        lastPromptAt.current = played.current;
        p.pause();
        setPrompt({ text: '' });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, promptsOn, promptInterval, saveProgress]);

  // Save when leaving the page or hiding the tab.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && saveProgress();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', saveProgress);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', saveProgress);
      saveProgress();
    };
  }, [saveProgress]);

  useEffect(() => {
    if (prompt) promptInput.current?.focus();
  }, [prompt]);

  /* ---------------------------------------------------------------- note composer */
  const openComposer = useCallback(() => {
    if (composer || prompt) {
      noteInput.current?.focus();
      return;
    }
    const p = player.current;
    const resume = !!p?.isPlaying();
    p?.pause();
    setError(null);
    setComposer({ time: formatTimestamp(p?.currentTime() ?? 0), text: '', resume });
    requestAnimationFrame(() => noteInput.current?.focus());
  }, [composer, prompt]);

  function closeComposer(resume: boolean) {
    setComposer(null);
    if (resume) player.current?.play();
  }

  async function saveNote() {
    if (!composer) return;
    if (!composer.text.trim()) return closeComposer(composer.resume);
    const t = parseTimestamp(composer.time);
    if (t === null) return setError('Use a time like 1:05 or 1:02:03.');
    await repo.addNote(id, t, composer.text);
    closeComposer(composer.resume);
  }

  async function savePrompt() {
    if (!prompt) return;
    if (prompt.text.trim()) await repo.addNote(id, player.current?.currentTime() ?? 0, prompt.text);
    setPrompt(null);
    player.current?.play();
  }

  // N = new note (only when not typing in a field and focus isn't inside the video frame).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === 'n' || e.key === 'N') && isShortcutTarget(e.target)) {
        e.preventDefault();
        openComposer();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openComposer]);

  function seek(t: number) {
    player.current?.seekTo(t);
    player.current?.play();
  }

  async function doneWatching() {
    saveProgress();
    navigate(`/video/${id}/log`);
  }

  /* ---------------------------------------------------------------- render */
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

  const logged = video.status === 'logged';

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:space-y-0">
      {/* Left: purpose, player, composer */}
      <div className="space-y-4">
        <section className="flex items-start gap-2 rounded-card bg-surface-2 px-4 py-3" aria-label="Your purpose">
          <Target size={18} aria-hidden className="mt-0.5 shrink-0 text-fg-muted" />
          <p className="text-sm">
            <span className="font-semibold">Watching for: </span>
            {video.purpose}
          </p>
        </section>

        <div className="relative aspect-video overflow-hidden rounded-card bg-black">
          {playerError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <TriangleAlert size={28} aria-hidden />
              <p className="max-w-sm text-sm">{playerError}</p>
              <a href={video.url} target="_blank" rel="noopener noreferrer" className="btn rounded-full bg-white text-black hover:bg-white/90">
                <ExternalLink size={18} aria-hidden /> Watch on YouTube
              </a>
              <p className="max-w-sm text-xs text-white/70">You can still add notes below; type the time yourself.</p>
            </div>
          ) : (
            <YouTubePlayer
              ref={player}
              youtubeId={video.youtubeId}
              start={startAt}
              title={video.title}
              onReady={() => setReady(true)}
              onPlayingChange={(playing) => {
                lastTick.current = Date.now();
                if (!playing) saveProgress();
              }}
              onError={setPlayerError}
            />
          )}
        </div>

        <header className="space-y-1.5">
          <h1 className="text-xl leading-snug">{video.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
            {video.channel && <span>{video.channel}</span>}
            <GoalBadge goal={goal} />
            {startAt > 0 && <span>{jumpTo > 0 ? 'Starting at' : 'Resumed at'} {formatTimestamp(startAt)}</span>}
          </div>
        </header>

        {/* Pause prompt */}
        {prompt && (
          <form
            className="space-y-3 rounded-card border-l-4 border-l-accent bg-surface-2 p-4"
            role="dialog"
            aria-labelledby="prompt-h"
            onSubmit={(e) => {
              e.preventDefault();
              savePrompt();
            }}
          >
            <p id="prompt-h" className="flex items-center gap-2 font-semibold">
              <MessageSquareText size={18} aria-hidden /> Pause: explain the last part in one sentence.
            </p>
            <input
              ref={promptInput}
              className="input"
              aria-label="Your one-sentence summary"
              value={prompt.text}
              onChange={(e) => setPrompt({ text: e.target.value })}
              onKeyDown={(e) => e.key === 'Escape' && (setPrompt(null), player.current?.play())}
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                Save & keep watching
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPrompt(null);
                  player.current?.play();
                }}
              >
                Skip
              </button>
            </div>
            <p className="hint text-xs">Saved as a note at this point in the video. Turn these off in Settings.</p>
          </form>
        )}

        {/* Note composer */}
        {composer ? (
          <form
            className="panel space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveNote();
            }}
          >
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="note-time">
                Time
              </label>
              <input
                id="note-time"
                className="input w-24 shrink-0 font-mono tabular-nums"
                value={composer.time}
                onChange={(e) => setComposer({ ...composer, time: e.target.value })}
              />
              <label className="sr-only" htmlFor="note-text">
                Note in your own words
              </label>
              <input
                id="note-text"
                ref={noteInput}
                className="input min-w-0 flex-1"
                placeholder="In your own words…"
                value={composer.text}
                onChange={(e) => setComposer({ ...composer, text: e.target.value })}
                onKeyDown={(e) => e.key === 'Escape' && closeComposer(composer.resume)}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            {/* A submit button is required: with two fields, Enter only submits when one exists. */}
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary">
                Save{composer.resume ? ' & resume' : ''}
              </button>
              <button type="button" className="btn-ghost" onClick={() => closeComposer(composer.resume)}>
                Cancel
              </button>
              <p className="hint ml-auto hidden text-xs sm:block">
                <kbd>Enter</kbd> save · <kbd>Esc</kbd> cancel
              </p>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={openComposer} disabled={!!prompt}>
              <Plus size={18} aria-hidden /> Note
            </button>
            <p className="hint hidden sm:block">
              or press <kbd>N</kbd> (click outside the video first). It pauses and captures the time.
            </p>
          </div>
        )}
      </div>

      {/* Right: notes + finish */}
      <aside className="space-y-4">
        <section className="panel" aria-labelledby="notes-h">
          <h2 id="notes-h" className="mb-2 flex items-baseline justify-between">
            Notes <span className="text-sm font-normal text-fg-muted">{notes.length}</span>
          </h2>
          {notes.length === 0 ? (
            <p className="hint">Pause at key moments and write the idea in your own words. Short is fine.</p>
          ) : (
            <TimestampNoteList
              notes={notes}
              onSeek={ready && !playerError ? seek : undefined}
              onEdit={(nid, patch) => repo.updateNote(nid, patch)}
              onDelete={(nid) => repo.deleteNote(nid)}
            />
          )}
        </section>

        {logged ? (
          <p className="notice-success">This video is already logged. Notes you add here are kept with it.</p>
        ) : (
          <div className="space-y-2">
            <button type="button" className="btn-primary w-full" onClick={doneWatching}>
              Done watching <ArrowRight size={18} aria-hidden />
            </button>
            <p className="hint text-center text-xs">Next: recall what you remember before seeing these notes.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
