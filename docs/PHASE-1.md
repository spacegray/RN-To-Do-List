# Phase 1 plan: accounts, database and security

Status: **1a, 1b and 1c done** (1c tested against the local copy: upgrade to UUIDs with two tabs open, sending, pulling edits and deletes, second device, settings both ways, offline and back, a second account on the same device). Next: 1d.

## Goal

Anyone can keep using Daypad without an account, exactly as today. Signing in saves tasks, notes and settings to
the database so they follow you to any device, and sets up the pieces every later phase needs: users, roles, access
rules and a sync engine.

## Principles

- **Local first.** The app keeps reading and writing the on-device stores it has now, so it stays instant and works
  offline. A sync engine copies changes to and from the database in the background.
- **Locked by default.** Row Level Security on every table; no table is reachable from the app until a migration
  grants it; users can only ever see their own rows.
- **Everything in the repo.** Tables, rules and functions are SQL migration files in `supabase/migrations`, applied
  with the Supabase CLI. TypeScript types are generated from the database.
- **Built on a branch** (`phase-1-accounts`), merged to `main` when each piece works, so `main` stays deployable.

## Database

| Table | Columns (main ones) | Notes |
|---|---|---|
| `profiles` | `id` (= the sign-in user), `display_name`, `avatar_url`, `role` (`user` / `admin` / `super_admin`), timestamps | Created automatically on sign-up. Users can edit their name and avatar, never their role. |
| `settings` | `user_id`, `prefs` (JSON: theme, colours, saved colour sets, tour seen…), `updated_at` | One row per user |
| `lists` | `id`, `user_id`, `name`, `position`, timestamps, `deleted_at` | Created now so phase 2's multiple lists need no data move. Everyone starts with one list, "Tasks". |
| `tasks` | `id`, `user_id`, `list_id`, `title`, `done`, `due_at`, `tag`, `priority`, `created_at`, `completed_at`, `updated_at`, `deleted_at` | Reminder scheduling details stay on each device |
| `notes` | `id`, `user_id`, `title`, `body`, `calc` (saved calculator tape), `reminder_at`, `pinned`, timestamps, `deleted_at` | |

- **Soft delete:** `deleted_at` instead of removing rows, so deletes sync to other devices and the 30-day recycle bin
  (phase 2) comes free. A scheduled job clears rows deleted more than 30 days ago.
- **IDs:** switch from the current short IDs to UUIDs; existing local items get new IDs once, on first sign-in.
- **Stays on the device for now:** the calculator's working tape, drafts, which tab is open, reminder notification IDs.
- **Encrypted fields:** none of today's data is sensitive enough to need it; the encryption setup arrives with the
  journal, dream journal and onboarding answers.

## Access rules (RLS)

- `tasks`, `notes`, `lists`, `settings`: a signed-in user can read, add, change and delete only rows where
  `user_id` is their own ID; new rows must carry their own ID.
- `profiles`: users read and update their own row; only the name and avatar columns can be changed by the app.
- `role` changes only through a database function that checks the caller is a super admin (used by the admin panel
  in phase 7).
- Signed-out visitors can't read or write anything.

## Sync

1. Every local change marks the item "dirty" with a timestamp.
2. When signed in and online, dirty items are sent to the database in batches (every few seconds, and when the app
   goes to the background).
3. The app then asks for anything changed since its last sync, which brings in edits from other devices.
4. If the same item changed on two devices, the most recent change wins.
5. Live updates between open devices (Supabase Realtime) come in phase 10 with shared lists.

**First sign-in on a device:** everything on the device is added to the account (nothing is overwritten); a toast
says "Moved 6 tasks and 3 notes into your account." Signing out keeps a local copy, so the app still works.

The merge, the dirty tracking and "most recent wins" are pure functions with unit tests, like the existing
persistence tests.

## Sign-in

| Method | When | Setup you'll do |
|---|---|---|
| Email link (no password) | Step 1b | None, already on |
| Google | Step 1d | Create an OAuth client in Google Cloud and paste its ID and secret into Supabase (I'll guide you) |
| GitHub | Step 1d | Create an OAuth app in GitHub settings, same idea |
| Microsoft, Apple | Later | Microsoft needs an Azure app; Apple needs the $99/year developer account |

Sign-in redirects back to `daypad.vercel.app` (and `localhost` while developing). Two-factor login is turned on
in phase 7, when the admin panel exists.

## Screens

- **Account button** in the toolbar (a person icon, or your avatar once signed in).
- **Sign-in sheet:** Continue with Google, Continue with GitHub, or email me a link; "Keep using without an account".
- **Account sheet:** name and avatar, sync status ("Synced just now" / "Offline, will sync later"), Export my data
  (JSON download), Sign out, Delete account (asks twice, deletes everything).
- **Privacy policy and terms pages**, linked from the sign-in sheet and the footer (Google requires both).

## Security extras in this phase

- Bot protection on sign-up with Cloudflare Turnstile (Supabase supports it directly).
- Account deletion runs in a Supabase server function (Edge Function), the only place the secret key is used; it
  never ships in the app.
- Nightly database backup with a GitHub Action, stored privately.
- `SECURITY.md` describing the rules above.

## Build order (each step: build, test, commit)

| Step | What | Ease |
|---|---|---|
| 1a | **Done.** Supabase CLI, migrations for the five tables, access rules, triggers (new user → profile, settings and a "Tasks" list; `updated_at` stamps), generated types, 17 database tests | 🟡 |
| 1b | **Done.** Email link and code sign-in, account button and sheets, name change, sign out | 🟢 |
| 1c | **Done.** Sync engine and first-sign-in merge, with unit tests | 🟡 / 🔴 |
| 1d | Google and GitHub sign-in | 🟢 (plus your setup in Google and GitHub) |
| 1e | Privacy and terms pages, Turnstile, export data, delete account | 🟡 |
| 1f | Add the Supabase values to Vercel, deploy, nightly backups, `SECURITY.md` | 🟢 |

## What you'll need to do

- Done: Supabase CLI logged in and linked; Docker (OrbStack) installed for the local copy.
- Later steps: create the Google and GitHub OAuth apps, a free Cloudflare Turnstile key, and add two values to Vercel.
  I'll give exact steps at each one.

## Step 1b in detail: email sign-in and account screens

**Sign-in by email link or code.** The user enters an email; Supabase sends one email containing both a sign-in link
and a 6-digit code.
- The link signs you in when opened in the same browser.
- The code works anywhere: read the email on your phone, type the code on your laptop. It's also how the phone apps
  will sign in later, without needing deep links.
- No passwords to store, reset or leak.

**Pieces**

| Piece | What |
|---|---|
| `src/store/auth.ts` | Holds the session, user and profile; follows Supabase's sign-in and sign-out events; does nothing when Supabase isn't configured |
| Account button | Fourth toolbar button: a person icon signed out, your initials (or photo) signed in |
| Sign-in sheet | Email field, "Email me a sign-in link", "Keep using without an account"; Google and GitHub buttons arrive in 1d |
| Code sheet | "Check your email": 6-digit code boxes, Resend (after 60 seconds), Use a different email |
| Account sheet | Initials, name (editable) and email; Sign out. Export and Delete account arrive in 1e |
| Messages | Wrong or expired code, too many tries, offline, sent again |

**Development uses the local copy.** While developing, the app points at the local Supabase in Docker
(`.env.development.local`, not committed): sign-in emails land in a local inbox (Mailpit at `127.0.0.1:54324`) with no
sending limits. Production builds keep using the real project.

**Your setup (one time, in the Supabase dashboard):**
- Authentication → URL Configuration: Site URL `https://daypad.vercel.app`, plus redirect URL `http://localhost:8090`.
- Authentication → Emails → "Magic Link" template: add the code (`{{ .Token }}`) to the email. I'll give you the text.

**Not live yet.** Signing in won't save anything until the sync engine (1c), so 1b is merged to `main` but not
deployed until 1c works.

**Limits to know:** Supabase's built-in email sender only delivers to your own team's addresses and a few emails an
hour. Before real users can sign up, step 1f connects a proper sender (Resend, free for 3,000 emails a month).

**After your first sign-in:** one SQL line in the dashboard makes your account the super admin.

## Step 1c in detail: sync

**What syncs:** tasks, notes, and settings (theme, colours, saved colour sets, tour seen). **Stays on each device:**
reminder notification IDs and "already fired" flags, the calculator's working tape, drafts, open tab, filters.

### Local changes first

| Change | Why |
|---|---|
| IDs become UUIDs, once, on load (tasks and notes stores move to version 2) | The database uses UUIDs; every device must agree on an item's ID |
| Every task and note gets a `changedAt` stamp, set by each change that should sync (add, edit, done, priority, pin, reminder time, undo delete) | "Newest change wins" needs it. Notes keep `updatedAt` for sorting by last edit |
| A small `daypad.sync` store (saved on the device) | Which account this device last synced with, the last time it pulled, the default list's ID, and what it has already sent |

### The engine (`src/lib/sync.ts`, pure functions, unit-tested)

- **Find what to send:** compare the local items with what was last sent. New or changed items (newer `changedAt`)
  are upserted; items that were sent before but are gone locally are sent as deleted (`deleted_at`).
- **Apply what arrives:** a pulled row replaces the local item only if it's newer; a pulled delete removes it only if
  the local copy isn't newer. Pulled items keep this device's reminder details, and future reminders are scheduled.
- **Convert rows:** local times are milliseconds, the database uses timestamps; tasks get the account's "Tasks" list.

### When it runs (`src/store/sync.ts`)

- Right after sign-in, a few seconds after any change, when the app comes back to the foreground or back online, and
  every 30 seconds while open.
- **Send:** changed items in batches of 100. **Pull:** rows changed since the last pull (with a few seconds of overlap,
  since applying a row twice is harmless), 500 at a time.
- Failures retry with growing waits (5 s, 15 s, 1 min…). Nothing is lost while offline: unsent changes are simply
  still "newer than what was sent".

### First sign-in on a device

- **Account is empty:** everything on the device is sent up. Toast: "Moved 4 tasks and 2 notes into your account."
- **Account already has things** (signing in on a second device): both are combined, nothing overwritten. The sample
  tasks and notes Daypad starts with are dropped if untouched, so they don't pile up across devices.
- **This device last synced with a different account:** ask first. "This device has tasks from another account.
  Add them to this account, or start fresh?" Start fresh keeps a one-step undo until the app closes.

### Status you can see

| Where | What |
|---|---|
| Dot on the avatar | Green: synced · Amber: syncing or changes waiting · Grey: offline · Red: couldn't sync |
| Account sheet | "Synced just now" / "Syncing…" / "Offline. Changes will sync when you're back." / "Couldn't sync. Try again" button |

### Tests

- Unit tests for the engine: what gets sent, newest-wins in both directions, deletes and undo, sample-task cleanup,
  row conversion, ID migration.
- End to end in the browser against the local copy: sign in, add and edit tasks, check the database; clear the
  browser's storage to act as a second device, sign in, and see everything arrive; edit on both and confirm the
  newest edit wins; go offline, make changes, come back.

**After 1c:** the app is safe to deploy (your own email can sign in with the standard Supabase emails); step 1f adds the
Vercel settings and the proper email sender for everyone else.

### 1c notes from testing

- Two open tabs share one browser's storage, so the one-time ID upgrade must give the same IDs in both: new IDs are
  worked out from the old ones (`stableUuid`), never random.
- Sync waits until every saved store has loaded; starting earlier sent the starter tasks instead of the saved ones.
- Sync messages wait for the landing page to close, or they'd be hidden behind it.
- With the connection gone, the Supabase library retries for about 15 seconds before the status changes to "Offline".
- Not tested yet: "Add them to my account" (same path as a first sign-in, which is tested), and phone notifications for
  reminders that arrive from another device (needs a phone build).
