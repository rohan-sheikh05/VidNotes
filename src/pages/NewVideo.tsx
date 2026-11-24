import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Play, TriangleAlert } from 'lucide-react';
import * as repo from '../db/repo';
import { canonicalUrl, fetchMetadata, parseYouTubeId, thumbnailFor, type VideoMeta } from '../lib/youtube';

type MetaState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; meta: VideoMeta };

export default function NewVideo() {
  const navigate = useNavigate();
  const goals = useLiveQuery(() => repo.listGoals(), []);
  const activeGoal = goals?.find((g) => g.status === 'active');
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const startedToday = useLiveQuery(() => repo.countVideosStartedToday(), []);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null); // null = not touched → default to active goal
  const [purpose, setPurpose] = useState('');
  const [meta, setMeta] = useState<MetaState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const youtubeId = parseYouTubeId(url);
  const existing = useLiveQuery(async () => (youtubeId ? repo.findVideoByYoutubeId(youtubeId) : undefined), [youtubeId]);
  const selectedGoalId = goalId ?? activeGoal?.id ?? '';

  useEffect(() => {
    if (!youtubeId) {
      setMeta({ status: 'idle' });
      return;
    }
    const ctrl = new AbortController();
    setMeta({ status: 'loading' });
    fetchMetadata(youtubeId, ctrl.signal).then((m) => {
      if (ctrl.signal.aborted) return;
      setMeta({ status: 'done', meta: m });
      if (m.title) setTitle(m.title);
    });
    return () => ctrl.abort();
  }, [youtubeId]);

  const fetched = meta.status === 'done' ? meta.meta : {};
  const canSave = !!youtubeId && title.trim().length > 0 && purpose.trim().length > 0 && !saving;

  async function save(next: 'watch' | 'log' | 'youtube') {
    if (!youtubeId) return;
    setError(null);
    setSaving(true);
    try {
      const id = await repo.createVideo({
        url: url.trim() || canonicalUrl(youtubeId),
        youtubeId,
        title,
        channel: fetched.channel,
        thumbnailUrl: fetched.thumbnailUrl ?? thumbnailFor(youtubeId),
        goalId: selectedGoalId || undefined,
        purpose,
      });
      if (next === 'youtube') {
        window.open(url.trim() || canonicalUrl(youtubeId), '_blank', 'noopener');
        navigate('/');
      } else {
        navigate(`/video/${id}/${next}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const overCap = settings && startedToday !== undefined && startedToday >= settings.maxNewVideosPerDay;

  return (
    <div className="space-y-5">
      <h1>Log a video</h1>

      {overCap && (
        <p className="notice-warning">
          <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>
          You've started {startedToday} videos today. Review or apply something first?{' '}
          <Link to="/review" className="font-semibold underline">
            Go to review
          </Link>
          </span>
        </p>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) save('watch');
        }}
      >
        <div>
          <label className="label" htmlFor="url">
            YouTube URL
          </label>
          <input
            id="url"
            className="input"
            inputMode="url"
            autoFocus
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          {url.trim() && !youtubeId && <p className="error-text mt-1.5">That doesn't look like a YouTube video link.</p>}
          {existing && (
            <p className="mt-1 text-sm font-medium text-on-warning-soft">
              You already added this video ({existing.status === 'logged' ? 'logged' : 'not finished'}).
              {existing.status === 'watching' && (
                <>
                  {' '}
                  <Link className="underline" to={`/video/${existing.id}/log`}>
                    Finish that log instead
                  </Link>
                </>
              )}
            </p>
          )}
        </div>

        {youtubeId && (
          <div className="panel flex gap-3">
            <img
              src={fetched.thumbnailUrl ?? thumbnailFor(youtubeId)}
              alt=""
              className="h-20 w-32 shrink-0 rounded-lg bg-surface-2 object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <label className="label" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                className="input"
                placeholder={meta.status === 'loading' ? 'Fetching title…' : 'Type the video title'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {meta.status === 'done' && !fetched.title && (
                <p className="text-xs text-fg-muted">Couldn't fetch details automatically. Type the title yourself.</p>
              )}
              {fetched.channel && <p className="text-xs text-fg-muted">{fetched.channel}</p>}
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="goal">
            Goal
          </label>
          <select id="goal" className="input" value={selectedGoalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal</option>
            {goals?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
                {g.status === 'archived' ? ' (archived)' : ''}
              </option>
            ))}
          </select>
          {!selectedGoalId && <p className="hint mt-1">Is this part of what you're learning right now?</p>}
        </div>

        <div>
          <label className="label" htmlFor="purpose">
            What do I want to get from this video? <span className="text-danger" aria-hidden>*</span>
          </label>
          <textarea
            id="purpose"
            className="input min-h-[80px]"
            placeholder="e.g. Understand when to use a list comprehension instead of a loop"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="btn-primary flex-1" disabled={!canSave}>
            <Play size={18} aria-hidden /> Watch here
          </button>
          <button type="button" className="btn-secondary flex-1" disabled={!canSave} onClick={() => save('log')}>
            I already watched it → Log
          </button>
        </div>
        <p className="hint">
          <strong className="font-medium text-fg">Watch here</strong> lets you take timestamped notes as you go.{' '}
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-1 font-medium text-link hover:underline disabled:opacity-50"
            disabled={!canSave}
            onClick={() => save('youtube')}
          >
            <ExternalLink size={14} aria-hidden /> Watch on YouTube instead
          </button>
        </p>
      </form>
    </div>
  );
}
