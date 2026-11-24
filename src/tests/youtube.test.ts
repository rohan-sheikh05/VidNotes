import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMetadata, formatTimestamp, parseStartTime, parseYouTubeId } from '../lib/youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `http://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&list=abc`,
    `https://www.youtube.com/watch?feature=share&v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}&t=90s`,
    `https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=42`,
    `youtu.be/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://youtube.com/shorts/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?start=30`,
    `https://www.youtube.com/live/${ID}`,
    `  https://www.youtube.com/watch?v=${ID}  `,
    ID,
  ])('parses %s', (url) => {
    expect(parseYouTubeId(url)).toBe(ID);
  });

  it.each([
    '',
    'not a url',
    'https://vimeo.com/123456',
    'https://www.youtube.com/',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UC1234567890',
    'https://evil.com/watch?v=dQw4w9WgXcQ',
  ])('rejects %s', (url) => {
    expect(parseYouTubeId(url)).toBeNull();
  });
});

describe('parseStartTime', () => {
  it.each<[string, number | null]>([
    [`https://www.youtube.com/watch?v=${ID}&t=90`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=90s`, 90],
    [`https://youtu.be/${ID}?t=1m30s`, 90],
    [`https://youtu.be/${ID}?t=1h2m3s`, 3723],
    [`https://www.youtube.com/embed/${ID}?start=30`, 30],
    [`https://www.youtube.com/watch?v=${ID}`, null],
    [`https://www.youtube.com/watch?v=${ID}&t=abc`, null],
  ])('%s → %s', (url, expected) => {
    expect(parseStartTime(url)).toBe(expected);
  });
});

describe('formatTimestamp', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(65)).toBe('1:05');
    expect(formatTimestamp(3723)).toBe('1:02:03');
  });
});

describe('fetchMetadata', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps noembed fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: 'T', author_name: 'C', thumbnail_url: 'https://img' }),
      }),
    );
    expect(await fetchMetadata(ID)).toEqual({ title: 'T', channel: 'C', thumbnailUrl: 'https://img' });
  });

  it('returns {} on error response or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: '404 Not Found' }) }));
    expect(await fetchMetadata(ID)).toEqual({});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchMetadata(ID)).toEqual({});
  });
});
