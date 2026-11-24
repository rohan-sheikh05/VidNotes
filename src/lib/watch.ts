/** Pure helpers for the Watch page (Phase 2). */

/** Seconds of actual playback between "explain the last part" prompts (spec §5.3). */
export const PROMPT_INTERVAL_SEC = 600;

/** How far back to rewind when resuming, so the user gets a little context. */
export const RESUME_REWIND_SEC = 3;

/** A prompt is due after another full interval of *playback* (not wall-clock) time. */
export function isPromptDue(playedSec: number, lastPromptAtPlayedSec: number, interval = PROMPT_INTERVAL_SEC): boolean {
  return interval > 0 && playedSec - lastPromptAtPlayedSec >= interval;
}

/**
 * Playback seconds to add for one tick. Clamps large gaps (tab sleeping, seeking, slow devices)
 * so a backgrounded tab can't jump straight to a prompt.
 */
export function playbackDelta(prevWallMs: number, nowWallMs: number, rate = 1, maxStepSec = 2): number {
  const dt = (nowWallMs - prevWallMs) / 1000;
  if (!(dt > 0)) return 0;
  return Math.min(dt, maxStepSec) * (rate > 0 ? rate : 1);
}

/**
 * Where to start playback for a saved position. Starts over when the saved position is near
 * the start or the end, otherwise rewinds a few seconds.
 */
export function resumeAt(positionSec: number | undefined, durationSec?: number): number {
  if (!positionSec || positionSec < 10) return 0;
  if (durationSec && positionSec > durationSec - 15) return 0;
  return Math.max(0, Math.floor(positionSec - RESUME_REWIND_SEC));
}

/** Watched fraction for the thumbnail progress bar (0–1), or null when unknown. */
export function watchedFraction(positionSec?: number, durationSec?: number): number | null {
  if (!durationSec || durationSec <= 0 || positionSec === undefined) return null;
  return Math.min(1, Math.max(0, positionSec / durationSec));
}

/** True when a key event should trigger a page shortcut (not while typing in a field). */
export function isShortcutTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return true;
  return !el.closest('input, textarea, select, [contenteditable="true"], iframe');
}
