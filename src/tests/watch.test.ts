import { describe, expect, it } from 'vitest';
import { isPromptDue, isShortcutTarget, playbackDelta, PROMPT_INTERVAL_SEC, resumeAt, watchedFraction } from '../lib/watch';
import { parseTimestamp } from '../lib/youtube';

describe('isPromptDue', () => {
  it('fires after a full interval of playback', () => {
    expect(isPromptDue(PROMPT_INTERVAL_SEC - 1, 0)).toBe(false);
    expect(isPromptDue(PROMPT_INTERVAL_SEC, 0)).toBe(true);
    expect(isPromptDue(PROMPT_INTERVAL_SEC + 100, PROMPT_INTERVAL_SEC)).toBe(false);
    expect(isPromptDue(2 * PROMPT_INTERVAL_SEC, PROMPT_INTERVAL_SEC)).toBe(true);
  });
  it('never fires with a non-positive interval', () => {
    expect(isPromptDue(10_000, 0, 0)).toBe(false);
  });
});

describe('playbackDelta', () => {
  it('counts elapsed time scaled by playback rate', () => {
    expect(playbackDelta(0, 1000)).toBe(1);
    expect(playbackDelta(0, 1000, 2)).toBe(2);
  });
  it('clamps long gaps (backgrounded tab) and ignores bad input', () => {
    expect(playbackDelta(0, 60_000)).toBe(2);
    expect(playbackDelta(1000, 500)).toBe(0);
    expect(playbackDelta(0, NaN)).toBe(0);
  });
});

describe('resumeAt', () => {
  it('rewinds a little from the saved position', () => {
    expect(resumeAt(120, 600)).toBe(117);
  });
  it('starts over near the beginning, near the end, or with no position', () => {
    expect(resumeAt(undefined)).toBe(0);
    expect(resumeAt(5, 600)).toBe(0);
    expect(resumeAt(590, 600)).toBe(0);
  });
  it('works without a known duration', () => {
    expect(resumeAt(300)).toBe(297);
  });
});

describe('watchedFraction', () => {
  it('returns a clamped fraction or null', () => {
    expect(watchedFraction(30, 120)).toBe(0.25);
    expect(watchedFraction(200, 120)).toBe(1);
    expect(watchedFraction(30, undefined)).toBeNull();
    expect(watchedFraction(undefined, 120)).toBeNull();
  });
});

describe('isShortcutTarget', () => {
  const el = (match: boolean) => ({ closest: () => (match ? {} : null) }) as unknown as EventTarget;
  it('ignores keys typed into fields', () => {
    expect(isShortcutTarget(el(true))).toBe(false);
    expect(isShortcutTarget(el(false))).toBe(true);
    expect(isShortcutTarget(null)).toBe(true);
  });
});

describe('parseTimestamp', () => {
  it.each<[string, number | null]>([
    ['75', 75],
    ['1:15', 75],
    ['01:15', 75],
    ['1:02:03', 3723],
    [' 2:00 ', 120],
    ['1:75', null],
    ['abc', null],
    ['', null],
    ['1:2:3:4', null],
  ])('%s → %s', (s, v) => expect(parseTimestamp(s)).toBe(v));
});
