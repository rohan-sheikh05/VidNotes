# VidNotes — Architecture & Build Spec

A personal learning app that turns YouTube watching into retained knowledge and applied skills.
Core loop: **set a purpose → watch with timestamp notes → recall before reviewing → write takeaways + one action → review on a spaced schedule → apply.**

> How to use this file with Claude Code: put it in an empty folder as `SPEC.md`, then ask Claude Code:
> "Read SPEC.md and implement Phase 1. Stop after Phase 1 so I can test it."
> Go phase by phase. Don't ask for everything at once.

---

## 1. Design principles (why the app works the way it does)

1. **Recall before review.** After a video, the user writes a brain dump *before* seeing their timestamp notes. Retrieval is what builds memory.
2. **Output required.** A video is only "logged" when it has at least 1 takeaway and 1 action.
3. **Spaced review.** Every takeaway becomes a review card scheduled at growing intervals (≈1, 3, 7, 20, 50 days).
4. **Depth over breadth.** One active goal at a time. Videos are tied to goals, and there's a soft daily cap on new videos.
5. **Fast.** Logging takes 2–3 minutes. Daily review takes 5–10 minutes. If it feels like homework, it gets abandoned.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | Fast, well supported, Claude Code handles it well |
| Styling | **Tailwind CSS** | Quick to build a clean, mobile-friendly UI |
| Routing | **React Router** | Simple client-side pages |
| Storage | **IndexedDB via Dexie.js** (+ `dexie-react-hooks`) | Offline, local, no server, holds a lot of data |
| Video | **YouTube IFrame Player API** | Watch inside the app and capture timestamps |
| Video metadata | `https://noembed.com/embed?url=<youtube url>` | Title, channel and thumbnail with no API key. Fall back to manual title entry if it fails |
| Charts | **Recharts** | Stats page |
| Dates | **date-fns** | Scheduling math |
| PWA | **vite-plugin-pwa** | Install on phone, works offline |
| Tests | **Vitest** | Scheduler and stats logic |
| Deploy | **Vercel** or **GitHub Pages** (free) | Static site, no backend needed |

**Important limitation:** IndexedDB is per device and per browser. Data on your laptop won't appear on your phone until Phase 4 (sync). Phase 1 includes JSON export/import as a backup.

---

## 3. Data model (`src/db/types.ts`)

```ts
export type ID = string; // crypto.randomUUID()

export interface Goal {
  id: ID;
  title: string;              // "Learn Python for data analysis"
  why?: string;               // motivation, shown on dashboard
  status: 'active' | 'archived';
  createdAt: number;          // epoch ms
}

export interface Video {
  id: ID;
  url: string;
  youtubeId: string;
  title: string;
  channel?: string;
  thumbnailUrl?: string;
  goalId?: ID;
  purpose: string;            // "What do I want from this video?" (required before watching)
  status: 'watching' | 'logged';
  brainDump?: string;         // written BEFORE seeing notes
  openQuestions: string[];
  rating?: 1 | 2 | 3 | 4 | 5; // how useful was it
  createdAt: number;
  loggedAt?: number;
}

export interface TimestampNote {
  id: ID;
  videoId: ID;
  t: number;                  // seconds into video
  text: string;
  createdAt: number;
}

export interface Card {         // one per takeaway
  id: ID;
  videoId: ID;
  goalId?: ID;
  cue: string;                // question shown during review: "What is a list comprehension?"
  answer: string;             // the takeaway in the user's own words
  // scheduling state
  due: number;                // epoch ms (start of day)
  intervalDays: number;
  ease: number;               // starts 2.5, min 1.3
  reps: number;
  lapses: number;
  lastReviewedAt?: number;
  suspended: boolean;
  createdAt: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewLog {
  id: ID;
  cardId: ID;
  rating: Rating;
  reviewedAt: number;
  prevInterval: number;
  nextInterval: number;
}

export interface Action {
  id: ID;
  videoId: ID;
  goalId?: ID;
  text: string;               // "Write a script that cleans my CSV using pandas"
  dueDate: number;
  doneAt?: number;
  reflection?: string;        // "What happened when I tried it?"
  createdAt: number;
}

export interface Settings {
  id: 'settings';
  maxNewVideosPerDay: number; // default 3
  dailyReviewLimit: number;   // default 50
  theme: 'light' | 'dark' | 'system';
}
```

### Dexie schema (`src/db/db.ts`)

```ts
db.version(1).stores({
  goals:   'id, status, createdAt',
  videos:  'id, goalId, status, createdAt, loggedAt, youtubeId',
  notes:   'id, videoId, t',
  cards:   'id, videoId, goalId, due, suspended',
  reviews: 'id, cardId, reviewedAt',
  actions: 'id, videoId, goalId, dueDate, doneAt',
  settings:'id',
});
```

---

## 4. Folder structure

```
src/
  main.tsx
  App.tsx                 # router + layout (bottom nav on mobile, sidebar on desktop)
  db/
    db.ts                 # Dexie instance
    types.ts
    repo.ts               # all reads/writes (components never touch db directly)
    backup.ts             # export/import JSON
  lib/
    scheduler.ts          # spaced repetition (pure functions)
    stats.ts              # metrics (pure functions)
    youtube.ts            # parse ID from URL, fetch metadata
    dates.ts              # startOfDay helpers
  pages/
    Today.tsx
    NewVideo.tsx
    Watch.tsx
    LogVideo.tsx
    Review.tsx
    Actions.tsx
    Library.tsx
    VideoDetail.tsx
    Goals.tsx
    Stats.tsx
    Settings.tsx
  components/
    YouTubePlayer.tsx
    TimestampNoteList.tsx
    CardEditor.tsx
    ReviewCard.tsx
    ActionItem.tsx
    GoalBadge.tsx
    EmptyState.tsx
  tests/
    scheduler.test.ts
    stats.test.ts
    youtube.test.ts
```

Rule for Claude Code: **all business logic goes in `lib/` and `db/repo.ts` as pure or testable functions. Pages stay thin.**

---

## 5. Pages & user flows

### 5.1 Today (`/`), the home screen
- Active goal card (title + why).
- **Reviews due today: N**, with a big "Start review" button.
- **Actions due/overdue**, with checkboxes.
- **Unfinished videos** (status `watching`), with a "Finish log" link.
- "Log a new video" button. Shows a soft warning if today's new-video count ≥ `maxNewVideosPerDay`: *"You've started 3 videos today. Review or apply something first?"* (The user can still continue.)

### 5.2 New video (`/video/new`)
1. Paste the YouTube URL. Parse `youtubeId` (support `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, and `&t=` params).
2. Auto-fetch title, channel and thumbnail.
3. Pick a goal (defaults to the active goal). If "no goal" is picked, show the hint: *"Is this part of what you're learning right now?"*
4. **Purpose (required):** "What do I want to get from this video?"
5. Choose **Watch here** (→ `/video/:id/watch`) or **I already watched it** (→ `/video/:id/log`).

### 5.3 Watch (`/video/:id/watch`)
- Embedded YouTube player (IFrame API) with the purpose shown above it.
- Note box under the player. Press `N` (or tap "+ Note") to pause and capture the current timestamp, type a note in your own words, then press Enter to save and resume.
- Notes list with clickable timestamps that seek the player.
- Gentle prompt every 10 minutes of playback: *"Pause: explain the last part in one sentence."* (can be turned off in settings)
- "Done watching" goes to the Log page.

### 5.4 Log (`/video/:id/log`): the most important screen
A 4-step wizard. The timestamp notes are **hidden** until step 1 is submitted.

1. **Brain dump.** "Without looking, write everything you remember." Uses a textarea and needs at least ~20 characters. After submitting, the timestamp notes appear on the side so the user can compare with what they remembered.
2. **Takeaways → cards.** 1–3 rows, each with a *Cue* (a question) and an *Answer* (in your own words). Helper text: *"Write the cue as a question you'd want to be asked in a week."* At least one is required.
3. **Action.** One concrete action plus a due date (default: 2 days from now). Required.
4. **Questions & rating.** Open questions (optional, one per line) and a usefulness rating from 1–5.

On save: video `status = 'logged'`, cards are created with `due = tomorrow`, and the action is created. Show a summary: *"3 cards scheduled · first review tomorrow."*

### 5.5 Review (`/review`)
- Queue = cards where `due <= today` and not suspended, sorted by `due` ascending, capped at `dailyReviewLimit`.
- Show the **cue** only, with an optional "type your answer" box (recommended, not required).
- "Show answer" reveals the saved answer plus the video title and a link.
- Four buttons: **Forgot / Hard / Good / Easy**, each showing the next interval ("1d", "3d", "8d"…). Keyboard shortcuts `1–4`, `Space` to reveal.
- Cards rated "Forgot" are added again at the end of today's session.
- End screen: count reviewed, retention %, streak.
- Card menu: edit, suspend, delete.

### 5.6 Actions (`/actions`)
- Tabs: **Open** (sorted by due date, overdue in red) / **Done**.
- Marking an action done asks an optional one-line reflection: "What happened when you tried it?"

### 5.7 Library (`/library`) and Video detail (`/video/:id`)
- Search across titles, notes, takeaways and brain dumps. Filter by goal, status and rating.
- Detail shows everything for one video: purpose, brain dump, notes, cards, action and questions. Everything is editable.

### 5.8 Goals (`/goals`)
- Create, edit and archive goals. **Only one active goal at a time**: activating one archives the current active goal (with confirmation).
- Each goal shows its videos, cards, actions done, and a "weak spots" list (the cards it lapses on most).

### 5.9 Stats (`/stats`)
- **Applied ratio** = videos with ≥1 completed action ÷ videos logged (the headline number).
- Videos logged per week (bar chart).
- Review streak (consecutive days with ≥1 review).
- Retention, last 30 days = non-"again" reviews ÷ all reviews.
- Weakest goals/topics by lapse rate.
- Upcoming review load for the next 14 days (forecast bar chart).

### 5.10 Settings (`/settings`)
- Max new videos/day, daily review limit, theme, pause-prompt toggle.
- **Export JSON** (downloads all tables) and **Import JSON** (choose merge or replace, with validation).
- Danger zone: delete all data.

---

## 6. Spaced repetition algorithm (`src/lib/scheduler.ts`)

Simplified SM-2. Pure function, fully unit-tested.

```ts
const DAY = 86_400_000;

export function schedule(card: Card, rating: Rating, now: number): Partial<Card> {
  let { intervalDays, ease, reps, lapses } = card;

  if (rating === 'again') {
    lapses += 1;
    reps = 0;
    ease = Math.max(1.3, ease - 0.2);
    intervalDays = 1;
  } else {
    if (reps === 0) {
      intervalDays = rating === 'easy' ? 3 : 1;
    } else if (reps === 1) {
      intervalDays = rating === 'hard' ? 2 : rating === 'easy' ? 5 : 3;
    } else {
      const mult = rating === 'hard' ? 1.2 : rating === 'easy' ? ease * 1.3 : ease;
      intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * mult));
    }
    if (rating === 'hard') ease = Math.max(1.3, ease - 0.15);
    if (rating === 'easy') ease = ease + 0.15;
    reps += 1;
  }

  intervalDays = Math.min(intervalDays, 365);
  return {
    intervalDays, ease, reps, lapses,
    lastReviewedAt: now,
    due: startOfDay(now) + intervalDays * DAY,
  };
}

export function previewIntervals(card: Card): Record<Rating, number> { /* for button labels */ }
```

With "good" every time, this gives roughly 1 → 3 → 8 → 20 → 50 days.
Later upgrade: swap in `ts-fsrs` (the FSRS algorithm) behind the same `schedule()` signature.

Tests to write: the first review of each rating, the interval growing on "good", "again" resetting to 1 and lowering ease, ease never dropping below 1.3, the 365-day cap, and `due` always landing at the start of a day.

---

## 7. Build phases (give these to Claude Code one at a time)

### Phase 1: Core loop (MVP)
Vite + React + TS + Tailwind setup, the Dexie DB and repo, Goals (create/activate), New Video (URL parse + metadata), the **Log wizard** (all 4 steps, timestamp notes shown only if they exist), the **Review session** with the scheduler, the **Actions** list, the **Today** page, and Settings with export/import. Unit tests for `scheduler`, `youtube`.
✅ *Done when:* you can log a video you already watched, see its cards due tomorrow (test by temporarily changing the system date or adding a debug "time travel" setting), review them, and tick off the action.

### Phase 2: Watch inside the app
The `YouTubePlayer` component (IFrame API), timestamp notes with the `N` shortcut, clickable timestamps that seek, the 10-minute pause prompts, and resuming unfinished videos from Today.

### Phase 3: Insight
Library search + filters, Video detail editing, the Stats page with charts, goal weak spots, and the daily new-video cap warning. Unit tests for `stats`.

### Phase 4: Mobile + sync (optional, do it when you need phone + laptop)
- Configure the PWA (installable, offline cache, app icon).
- Sync with **Supabase** (free tier): email magic-link login, mirror each Dexie table to a Postgres table with `user_id` + `updated_at`, enable Row Level Security (`user_id = auth.uid()`), last-write-wins sync on app open and every 60s, plus soft deletes (a `deletedAt` field) so deletions sync.
- Keep the app fully usable offline. Sync is an add-on, not a requirement.

### Phase 5: Nice-to-haves
- AI help: generate cue questions from a takeaway, or check your typed review answer (needs an API key, so keep it optional and off by default).
- Weekly review screen: "This week you learned… / applied… / forgot…"
- Browser extension or bookmarklet: "Send current YouTube tab to VidNotes."
- Markdown export per goal (a personal knowledge book).

---

## 8. UI guidelines
- Mobile first. Bottom nav: **Today · Review · Add (+) · Actions · More**.
- One primary action per screen, with large tap targets.
- Show the count of due reviews as a badge on the nav.
- Dark mode supported.
- Empty states teach the method, e.g. *"No reviews due. Log a video and write takeaways to start building memory."*

---

## 9. Definition of done (whole project)
- `npm run build` passes, `npm test` passes, and there are no TypeScript errors.
- All data survives a page reload, and export → wipe → import restores everything.
- Lighthouse PWA + accessibility score ≥ 90 (from Phase 4).
- README explains how to run locally and deploy.
