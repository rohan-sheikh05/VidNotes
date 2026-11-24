import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { loadYouTubeApi, PlayerState, playerErrorMessage, type YTPlayer } from '../lib/youtubeApi';

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seekTo(sec: number): void;
  /** Current time in seconds (0 if the player isn't ready). */
  currentTime(): number;
  /** Duration in seconds (0 if unknown). */
  duration(): number;
  isPlaying(): boolean;
  playbackRate(): number;
}

interface Props {
  youtubeId: string;
  start?: number;
  title: string;
  onReady?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (message: string) => void;
}

/**
 * Embedded YouTube player via the IFrame API (privacy-enhanced youtube-nocookie host).
 * Never autoplays: the user starts playback.
 */
const YouTubePlayer = forwardRef<PlayerHandle, Props>(function YouTubePlayer(
  { youtubeId, start = 0, title, onReady, onPlayingChange, onError },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  // Keep latest callbacks without re-creating the player.
  const cb = useRef({ onReady, onPlayingChange, onError });
  cb.current = { onReady, onPlayingChange, onError };

  useImperativeHandle(ref, () => ({
    play: () => ready.current && player.current?.playVideo(),
    pause: () => ready.current && player.current?.pauseVideo(),
    seekTo: (sec) => {
      if (!ready.current || !player.current) return;
      player.current.seekTo(Math.max(0, sec), true);
    },
    currentTime: () => (ready.current ? player.current?.getCurrentTime() ?? 0 : 0),
    duration: () => (ready.current ? player.current?.getDuration() ?? 0 : 0),
    isPlaying: () => ready.current && player.current?.getPlayerState() === PlayerState.PLAYING,
    playbackRate: () => (ready.current ? player.current?.getPlaybackRate() ?? 1 : 1),
  }));

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        const el = document.createElement('div');
        host.appendChild(el);
        player.current = new YT.Player(el, {
          host: 'https://www.youtube-nocookie.com',
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: { start: Math.floor(start), rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onReady: () => {
              ready.current = true;
              const iframe = host.querySelector('iframe');
              if (iframe) iframe.title = `YouTube video: ${title}`;
              cb.current.onReady?.();
            },
            onStateChange: (e) => cb.current.onPlayingChange?.(e.data === PlayerState.PLAYING),
            onError: (e) => cb.current.onError?.(playerErrorMessage(e.data)),
          },
        });
      })
      .catch((e: Error) => !cancelled && cb.current.onError?.(e.message));
    return () => {
      cancelled = true;
      ready.current = false;
      try {
        player.current?.destroy();
      } catch {
        /* already gone */
      }
      player.current = null;
      host.innerHTML = '';
    };
    // Re-create only when the video changes; `start` is read once at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  return <div ref={hostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />;
});

export default YouTubePlayer;
