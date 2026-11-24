# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

VidNotes is a local-first learning app for YouTube videos. **Phases 1–3 are done:** the core loop, watching inside the app, and insight (Library, VideoDetail, Stats and goal weak spots). Phases 4 (PWA and sync) and 5 (extras) are not started.

The app goes beyond the spec in a few ways:
- **Settings:** two extra fields, `pausePrompts` and `timeOffsetDays`.
- **Video:** optional `positionSec` and `durationSec` fields. They aren't indexed, so adding them needed no schema version bump.
- **NewVideo:** a "Watch on YouTube instead" option that leaves the video in `watching` status.
- **Pages:** a `/more` page.
- **Dev-only URL options:** `?seed=demo` (demo data) and `?promptEvery=<sec>` on the watch page, which shortens the 10-minute pause prompt for testing.

The watch page (`src/pages/Watch.tsx`) uses the YouTube IFrame API through `src/lib/youtubeApi.ts` and `src/components/YouTubePlayer.tsx`, loaded from the youtube-nocookie host and never autoplaying. Its timing logic (prompt due, playback delta, resume point) lives in `src/lib/watch.ts` as pure functions. Library search is the pure `searchLibrary()` in `src/lib/search.ts`, and every Stats metric is a pure function in `src/lib/stats.ts`. Charts follow the dataviz skill: `src/components/ColumnChart.tsx` uses the "emphasis" form, with one accent bar, the rest grey, and a table view. The chart colours are the `--chart-*` tokens in `src/tokens.css`, already checked with that skill's validator; re-run the validator if you change them. Keys pressed while focus is inside the iframe never reach the page, so the N shortcut only works when focus is outside the video.

The spec, `vid-notes-spec.md`, is the source of truth for the data model, routes, UX copy, the scheduler algorithm and the build phases. Read the relevant section before you implement anything.

**Build one phase at a time** (spec §7). When the user asks for a phase, implement only that phase, then stop so they can test it. Don't pull work forward from later phases.

## Stack

React 18 + TypeScript + Vite, Tailwind, React Router, Dexie.js (IndexedDB) with `dexie-react-hooks`, date-fns, Recharts, Vitest, and vite-plugin-pwa (Phase 4). The app has no backend. Video metadata comes from `https://noembed.com/embed?url=...` and needs no API key; if that fetch fails, fall back to manual title entry. Supabase sync is optional and comes in Phase 4.

## Commands

- `npm run dev`: start the dev server
- `npm run build`: production build. It must pass with no TypeScript errors.
- `npm test`: run Vitest
- `npx vitest run src/tests/scheduler.test.ts`: run a single test file. Add `-t "<name>"` to run a single test.
- `src/tests/repo.test.ts` runs the repo and backup layer against `fake-indexeddb`. Every repo function that writes a timestamp takes an optional `at` argument, so tests can pass a fixed time.

## Architecture rules

- **Layering:** pages call `src/db/repo.ts`, and the repo calls the Dexie instance in `src/db/db.ts`. Components and pages never import `db` directly. All business logic lives in `src/lib/` (`scheduler.ts`, `stats.ts`, `youtube.ts`, `dates.ts`) as pure functions, or in `repo.ts`. Pages stay thin.
- **Types** are defined in `src/db/types.ts` exactly as spec §3 gives them. The Dexie schema is versioned. If you change indexes, add a new `db.version(n)`; don't edit version 1 after data exists.
- **Scheduler:** `schedule(card, rating, now)` is a pure simplified SM-2 (spec §6). Ease never drops below 1.3, intervals are capped at 365 days, and `due` always lands at `startOfDay`. A future swap to `ts-fsrs` must keep the same signature. `previewIntervals` drives the labels on the review buttons.
- **Dates:** store everything as epoch ms. Card `due` values are start-of-day, so compare due cards against `startOfDay(now)`. For "now", always use `now()` / `today()` from `lib/dates.ts`, never `Date.now()`. They apply the debug time-travel offset (`settings.timeOffsetDays`). `App.tsx` sets the offset before it renders, and remounts the route tree through `key={offset}` when the offset changes. Use `dayStartPlus()` instead of adding `n * DAY`, so dates stay correct across daylight-saving changes.
- **Backup:** `src/db/backup.ts` exports and imports every table as JSON (merge or replace, with validation). Export → wipe → import must restore everything.

## Behavioral invariants (easy to break)

- In the Log wizard, timestamp notes stay **hidden until the brain dump (step 1) is submitted**.
- A video becomes `status: 'logged'` only when it has ≥1 takeaway card and exactly one action. New cards get `due = tomorrow`.
- Only **one active goal** at a time. Activating a goal archives the current one, after a confirmation.
- The daily new-video cap is a **soft warning**. Never block the user.
- In a review session, cards rated "again" are re-queued at the end of the current session.
- Required tests: `scheduler` and `youtube` (Phase 1), `stats` (Phase 3). For the list of scheduler test cases, see spec §6. The YouTube URL parser must handle `watch?v=`, `youtu.be/`, `shorts/`, `embed/` and `&t=`.

## UI

Mobile first, with a bottom nav (Today · Review · Add · Actions · More) on mobile and a sidebar on desktop. The Review nav item shows a badge with the due count. Support dark mode. Empty states should teach the method (spec §8).

The visual system is token-based. Use only the semantic colour classes from `src/tokens.css` and `tailwind.config.js` (`bg-surface`, `text-fg-muted`, `bg-primary`, `text-link`, `bg-danger-soft` and so on), never raw Tailwind palette colours. Shared component classes (`.btn-*`, `.input`, `.panel`, `.notice-*`, `.eyebrow`) live in `src/index.css`. The look deliberately echoes YouTube, with neutral surfaces, Roboto, pill buttons and a red accent, but uses no YouTube logos or marks. See `design-system/vidnotes/MASTER.md` ("VidNotes overrides"). Icons come from `lucide-react`; don't use emoji as icons.

Logo masters, colours and usage rules are in `brand/README.md`. Rebuild the masters with `brand/build_logo.py`. The app uses `src/components/Logo.tsx` (the light and dark lockups), and the icons are in `public/`.

In dev, loading `/?seed=demo` wipes local data and fills it with demo content (`src/dev/seed.ts`). This is useful for manual and visual checks.

## Design skills

For any visual design work, load the matching skill before you start:

- UI, styling, tokens or themes: `ui-ux-pro-max:design` and its sub-skills `ui-styling` and `design-system`, plus `ui-ux-pro-max:ui-ux-pro-max`.
- Logo, app icon or favicon (needed for the Phase 4 PWA): `logo-design`.
