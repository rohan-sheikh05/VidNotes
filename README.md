# VidNotes

A personal learning app that turns YouTube watching into retained knowledge and applied skills:
**set a purpose → watch → recall before reviewing → write takeaways + one action → review on a spaced schedule → apply.**

Local-first: everything is stored in your browser (IndexedDB). There is no server and no account. See `vid-notes-spec.md` for the full design.

## Run locally

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Testing the review flow

New cards are due **tomorrow**. To try a review without waiting, open **Settings → Debug: time travel** and press **+1 day**. A banner shows while time travel is active. Press **Reset** to go back to the real date.

## Your data

Data lives in this browser on this device only. Use **Settings → Export JSON** to back up, and **Import JSON** (merge or replace) to restore or move to another browser.

## Deploy

It's a static site, so any static host works.

- **Vercel:** import the repo. The framework preset is Vite, the build command is `npm run build`, and the output directory is `dist`. Add a rewrite of all paths to `/index.html` so client-side routes work on refresh. Vercel's Vite preset handles this; otherwise add a `vercel.json` with `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`.
- **GitHub Pages:** set `base: '/<repo-name>/'` in `vite.config.ts`, build, and publish `dist/`. Copy `dist/index.html` to `dist/404.html` so deep links work.

## Status

- **Phase 1 (core loop):** goals, adding a video, the 4-step log wizard, spaced-repetition review, actions, Today, and settings with export/import.
- **Phase 2 (watch inside the app):**
  - an embedded YouTube player with your purpose shown above it
  - timestamp notes: press **N** or tap **+ Note**, then Enter to save
  - click a timestamp to jump to that point; edit or delete notes
  - a "pause and explain" prompt every 10 minutes of playback (can be turned off in Settings)
  - your position is saved, so **Continue** on Today resumes where you left off

- **Phase 3 (insight):**
  - **Library:** search across titles, notes, takeaways and brain dumps, filtered by goal, status and rating
  - **Video detail:** everything about one video on one page, all editable
  - **Stats:** applied ratio, review streak, 30-day retention, videos logged per week, a 14-day review forecast, weakest goals, and the cards you forget most
  - **Goals:** each goal shows its weak spots

Phases 4 and 5 (PWA and sync, extras) are described in the spec.
