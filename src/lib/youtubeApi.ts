/**
 * Minimal loader + types for the YouTube IFrame Player API
 * (https://developers.google.com/youtube/iframe_api_reference). Loaded once, on demand.
 */

export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(timeoutMs = 15_000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      loading = null;
      reject(new Error('YouTube player took too long to load.'));
    }, timeoutMs);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      window.clearTimeout(timer);
      resolve(window.YT!);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      window.clearTimeout(timer);
      loading = null;
      s.remove();
      reject(new Error('Could not load the YouTube player. Are you offline?'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Human-readable message for IFrame API error codes. */
export function playerErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'This video link looks invalid.';
    case 5:
      return 'This video can’t be played in the embedded player.';
    case 100:
      return 'This video was removed or is private.';
    case 101:
    case 150:
      return 'The owner doesn’t allow this video to be played outside YouTube.';
    default:
      return 'The video couldn’t be loaded.';
  }
}
