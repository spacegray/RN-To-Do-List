# Phase 1 plan: accounts, database and security

Status: **plan, waiting for approval.** Nothing here is built yet. Supabase project is connected (`npm run supabase:check`).

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
| 1a | Supabase CLI, migrations for the five tables, access rules, triggers (new user → profile, settings and a "Tasks" list; `updated_at` stamps), generated types | 🟡 |
| 1b | Email-link sign-in, account button and sheets, sign out | 🟢 |
| 1c | Sync engine and first-sign-in merge, with unit tests | 🟡 / 🔴 |
| 1d | Google and GitHub sign-in | 🟢 (plus your setup in Google and GitHub) |
| 1e | Privacy and terms pages, Turnstile, export data, delete account | 🟡 |
| 1f | Add the Supabase values to Vercel, deploy, nightly backups, `SECURITY.md` | 🟢 |

## What you'll need to do

- Log the Supabase CLI in once (`npx supabase login` opens your browser) and enter the database password when linking.
- Later steps: create the Google and GitHub OAuth apps, a free Cloudflare Turnstile key, and add two values to Vercel.
  I'll give exact steps at each one.
