const ID_RE = /^[A-Za-z0-9_-]{11}$/;

function toUrl(input: string): URL | null {
  const raw = input.trim();
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

/** Extract the 11-char YouTube video id from a URL (or a bare id). Returns null if none. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;

  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '').toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') candidate = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) candidate = parts[1] ?? null;
    else candidate = url.searchParams.get('v');
  }
  return candidate && ID_RE.test(candidate) ? candidate : null;
}

/** Parse a start time (`t=` or `start=`) like 90, 90s, 1m30s, 1h2m3s. Returns seconds or null. */
export function parseStartTime(input: string): number | null {
  const url = toUrl(input);
  if (!url) return null;
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function canonicalUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function thumbnailFor(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export interface VideoMeta {
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
}

/** Fetch title/channel/thumbnail from noembed. Never throws; returns {} on failure. */
export async function fetchMetadata(id: string, signal?: AbortSignal): Promise<VideoMeta> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(canonicalUrl(id))}`, { signal });
    if (!res.ok) return {};
    const data = await res.json();
    if (data.error) return {};
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      channel: typeof data.author_name === 'string' ? data.author_name : undefined,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
    };
  } catch {
    return {};
  }
}

export function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Parse "75", "1:15" or "1:02:03" into seconds. Returns null if invalid. */
export function parseTimestamp(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(s)) return null;
  const parts = s.split(':').map(Number);
  if (parts.slice(1).some((p) => p > 59)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
