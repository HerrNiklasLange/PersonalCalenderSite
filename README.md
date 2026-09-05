# Personal Planner

A password-protected personal planner: calendar, habit tracker, weekly time
blocker, notes and a workflow board. Works on mobile and desktop, and is
deployed to Netlify.

Data lives in **Netlify Blobs** and is read and written through Netlify
Functions, so every device that logs in sees the same data.

## Pages

| Page            | What it does |
| --------------- | ------------ |
| **Calendar**    | Month grid plus a day panel. Timed events and all-day items, notes, colours, and a done checkbox. |
| **Habits**      | GitHub-style contribution heatmap per habit, with current/best streaks and a 30-day rate. Yes/no habits and amount habits (e.g. 4h deep work). Amount habits can be "more is better" or "less is better" — the latter is how *Time spent online* is tracked. Ships with Deep work, Time spent online, Exercised, Ate healthy; add your own. |
| **Time blocks** | A recurring weekly schedule (Cal Newport style). Click an empty slot to add a block. **Review** mode records, per day, whether each block was Done / Partly / Missed with a note, and shows a duration-weighted "followed the plan" percentage for the week. Export the timetable as **PNG**, or **PDF** via the browser's print dialog. |
| **Notes**       | Searchable notes with tags, pinning and a small markdown subset (headings, lists, task lists, bold, italic, code, links). |
| **Workflow**    | Two boards — **Personal** and **Career**. Each has renameable columns (Not started / In progress / Done by default, add as many as you like), cards with notes and a free-text *area* tag, and a list of guiding **values** at the top of the board. |

## Setup

```bash
npm install
```

Create a `.env` (copy `.env.example`):

```
PLANNER_PASSWORD=your-password-here
SESSION_SECRET=a-long-random-string
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run locally — this serves the Vite app *and* the functions on one port:

```bash
npm run dev
```

Then open http://localhost:8888. (`npm run vite` alone starts only the
frontend; the API will 404.)

## Deploying to Netlify

1. Push this folder to a Git repository.
2. In Netlify, **Add new site → Import an existing project**, and pick the repo.
   The build settings come from `netlify.toml` (build `npm run build`, publish
   `dist`, functions in `netlify/functions`).
3. Under **Site configuration → Environment variables**, add
   `PLANNER_PASSWORD` and `SESSION_SECRET` with your real values.
4. Deploy. Netlify Blobs is enabled automatically for the site — no database to
   provision.

To deploy from your machine instead:

```bash
netlify deploy --build --prod
```

## How the login works

- `POST /api/login` compares the submitted password to `PLANNER_PASSWORD` in
  constant time, then sets an `HttpOnly`, `Secure`, `SameSite=Lax` session
  cookie signed with `SESSION_SECRET` (valid 30 days).
- Every `/api/data/*` request verifies that cookie, so the data is protected on
  the server — not just hidden in the UI.
- Eight failed attempts within 15 minutes lock login for 15 minutes. The
  counter is stored in Blobs so it survives function cold starts.
- Changing `SESSION_SECRET` invalidates all existing sessions.

## Data model

One Blobs document per feature: `calendar`, `habits`, `timeblocks`, `notes`,
`workflow`. Edits apply instantly in the UI and are flushed to the server on a
700 ms debounce (and on tab hide, so nothing is lost when you close the tab).

Writes replace the whole document, so if you edit the *same page* on two
devices at once, the last save wins. Different pages never conflict.

## Project layout

```
netlify/
  lib/auth.ts        session cookie signing, constant-time password compare
  lib/store.ts       Blobs access + login throttling
  functions/         login, logout, session, data  (Netlify Functions v2)
src/
  lib/               date helpers, API client, autosaving useDoc hook, PNG export
  components/        shell/navigation and shared UI primitives
  pages/             Login, Calendar, Habits, TimeBlocks, Notes, Workflow
```
