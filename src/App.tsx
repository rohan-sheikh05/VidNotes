import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChartColumn, Clock, Layers, Library as LibraryIcon, ListChecks, Menu, Plus, Settings as SettingsIcon, Sun, Target, type LucideIcon } from 'lucide-react';
import * as repo from './db/repo';
import { setTimeOffsetDays } from './lib/dates';
import type { Settings } from './db/types';
import Today from './pages/Today';
import NewVideo from './pages/NewVideo';
import LogVideo from './pages/LogVideo';
import Watch from './pages/Watch';
import Library from './pages/Library';
import VideoDetail from './pages/VideoDetail';
// Stats pulls in Recharts (~450 KB); load it only when the page is opened.
const Stats = lazy(() => import('./pages/Stats'));
import Review from './pages/Review';
import Actions from './pages/Actions';
import Goals from './pages/Goals';
import SettingsPage from './pages/Settings';
import More from './pages/More';
import NotFound from './pages/NotFound';
import Logo from './components/Logo';

function useTheme(theme: Settings['theme'] | undefined) {
  useEffect(() => {
    if (!theme) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: boolean;
  primary?: boolean;
  mobileOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun, end: true },
  { to: '/review', label: 'Review', icon: Layers, badge: true },
  { to: '/video/new', label: 'Add', icon: Plus, primary: true },
  { to: '/actions', label: 'Actions', icon: ListChecks },
  { to: '/more', label: 'More', icon: Menu, mobileOnly: true },
];
const DESKTOP_EXTRA: NavItem[] = [
  { to: '/library', label: 'Library', icon: LibraryIcon },
  { to: '/stats', label: 'Stats', icon: ChartColumn },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function countLabel(n: number) {
  return n > 99 ? '99+' : String(n);
}

function TimeTravelBanner({ offset, className = '' }: { offset: number; className?: string }) {
  if (offset === 0) return null;
  return (
    <div className={`notice-warning ${className}`} role="status">
      <Clock size={16} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        Time travel active: {offset > 0 ? '+' : ''}
        {offset} days
      </span>
    </div>
  );
}

export default function App() {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  useTheme(settings?.theme);

  // Apply time travel synchronously before children render; they remount via `key` when it changes.
  if (settings) setTimeOffsetDays(settings.timeOffsetDays);
  const offset = settings?.timeOffsetDays ?? 0;

  const due = useLiveQuery(() => repo.countDue(), [offset]) ?? 0;
  const wide = /\/watch$/.test(useLocation().pathname); // the watch page gets a wider two-column layout

  if (!settings) return null;

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 bg-bg p-3 md:flex">
        <NavLink to="/" className="mb-6 flex min-h-[44px] items-center rounded-control px-3" aria-label="VidNotes home">
          <Logo className="h-7" />
        </NavLink>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {[...NAV.filter((n) => !n.mobileOnly), ...DESKTOP_EXTRA].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-control px-3 font-medium transition-colors ${
                  isActive ? 'bg-surface-2 font-semibold text-fg' : 'text-fg hover:bg-surface-2'
                }`
              }
            >
              <n.icon size={20} aria-hidden />
              {n.primary ? 'Log a video' : n.label}
              {n.badge && due > 0 && (
                <span className="ml-auto min-w-[1.5rem] rounded-full bg-accent px-1.5 text-center text-xs font-bold leading-6 text-on-accent">
                  {countLabel(due)}
                  <span className="sr-only"> reviews due</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <TimeTravelBanner offset={offset} className="mt-auto" />
      </aside>

      <main className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-10`}>
        <TimeTravelBanner offset={offset} className="mb-4 md:hidden" />
        <Routes key={offset}>
          <Route path="/" element={<Today />} />
          <Route path="/video/new" element={<NewVideo />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/video/:id/watch" element={<Watch />} />
          <Route path="/video/:id/log" element={<LogVideo />} />
          <Route path="/review" element={<Review />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/library" element={<Library />} />
          <Route
            path="/stats"
            element={
              <Suspense fallback={<p className="hint">Loading stats…</p>}>
                <Stats />
              </Suspense>
            }
          />
          <Route path="/goals" element={<Goals />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Main"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `relative flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-fg' : 'text-fg-muted'
              }`
            }
          >
            {n.primary ? (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
                <Plus size={24} strokeWidth={2.5} aria-hidden />
              </span>
            ) : (
              <n.icon size={22} aria-hidden />
            )}
            <span className={n.primary ? 'sr-only' : ''}>{n.primary ? 'Log a video' : n.label}</span>
            {n.badge && due > 0 && (
              <span className="absolute left-1/2 top-2 ml-2 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-5 text-on-accent">
                {countLabel(due)}
                <span className="sr-only"> reviews due</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
