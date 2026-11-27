# Daypad roadmap

Last updated: November 27, 2026. Planning only: nothing below is built unless marked **Done**.
Every phase gets a mockup and a plan before it's built.

**Ease:** 🟢 easy · 🟡 medium · 🔴 hard (outside approvals, missing APIs, or a lot of work)
**Tier:** Free · Plus (see [Tiers](#tiers-and-stripe))

---

## Big decisions

| Decision | Choice | Why |
|---|---|---|
| Backend and database | **Supabase** (Postgres) | Sign-in, Row Level Security, encrypted secret storage (Vault), server functions, scheduled jobs, live updates and file storage in one free tier. SQL migrations and access rules are what employers ask about. |
| Hosting | Vercel (web), Expo's EAS build service (phone apps, later) | Already in use; connect Vercel to GitHub for automatic deploys and preview links |
| AI | Claude API through a Supabase server function | The key never reaches the browser; limits and costs are tracked per user |
| Payments | Stripe (test mode for the portfolio) | Checkout + customer portal + webhooks |
| Language | TypeScript everywhere, Zod for checking data | |

Other databases considered: Neon + Drizzle + Clerk (more pieces to wire), Firebase (no SQL), Convex (less common on job listings).

---

## Phases

### Now: small fixes

| Feature | Ease | Notes |
|---|---|---|
| Colors pill on the landing page, palette button in the app toolbar | 🟢 | **Done** |
| Colour panel themes the whole app: headings, subtext, outlines, calculator keys, progress bar | 🟡 | Mocked up. Colours adjusted until readable; priority and danger colours stay fixed; Classic look until someone picks colours; lighter shades in dark mode |
| Time next to the date ("FRI, NOV 27 · 9:41 AM") | 🟢 | Mocked up |

### Phase 0: groundwork

| Feature | Ease | Tools |
|---|---|---|
| Checks on every push (types, lint, tests) | 🟢 | GitHub Actions |
| Automatic deploys and preview links | 🟢 | Vercel's GitHub connection |
| Error tracking and analytics | 🟢 | Sentry, PostHog (free; never records what people type) |
| App ready for other languages (English and Spanish first) | 🟢 | i18next, expo-localization |
| Security headers, including a Content Security Policy | 🟢 | Vercel config |
| Vulnerable-package and leaked-key alerts | 🟢 | Dependabot, GitHub secret scanning |
| Short design notes and a `SECURITY.md` | 🟢 | |

### Phase 1: accounts, database and security

| Feature | Ease | Notes |
|---|---|---|
| Connect Supabase | 🟢 | In progress |
| Sign in with Google, GitHub, Microsoft, email link | 🟢 | Supabase Auth |
| Sign in with Apple | 🟡 | Needs the $99/year Apple Developer account |
| Move local tasks and notes into the account on first sign-in | 🟡 | |
| Roles: user, admin, super admin | 🟡 | Checked by the database, not just hidden in the interface |
| Row Level Security on every table, blocking by default | 🟡 | |
| Two-factor login, required for admins | 🟢 | |
| Encrypt sensitive fields (journal, dreams, onboarding needs, users' AI keys) | 🟡 | Supabase Vault |
| Bot protection on sign-up | 🟢 | Cloudflare Turnstile (free) |
| Privacy policy, terms, 13+ age rule | 🟢 | Google sign-in needs the first two |
| Export my data, delete my account | 🟢 | Apple requires deletion for App Store apps |
| Nightly database backup | 🟢 | GitHub Action, since the free plan has no backups |

### Phase 2: onboarding, settings and core lists

| Feature | Ease | Notes |
|---|---|---|
| Onboarding: goals (get organized, track dreams, split bills, fun calculator) | 🟢 | Sets the first screen and featured tools |
| Use for work, school, personal (any mix) | 🟡 | Work: priorities, Outlook/Teams calendar, meeting notes, paste an email to make tasks. School: lists per class, assignment due dates, exam countdowns, study timer, scientific calculator. Personal: grocery/packing/gift lists, journal, bill splitter, celebrations |
| Look and feel: low stimulation, balanced, high energy, minimal/zen | 🟢 | |
| Reminder style: gentle, standard, in your face | 🟢 | Quiet hours always apply |
| Task-help slider (1–5) | 🟢 | From "stay out of my way" to break-downs and one-task focus mode |
| Optional "what helps you" presets (ADHD, dyslexia, autism, Type A, neurotypical) | 🟡 | Ask about needs before diagnoses; private, encrypted, never in analytics |
| Settings page for all of the above | 🟢 | Everything changeable later |
| Multiple task lists (create, rename, delete) | 🟢 | Free: up to 5 lists; Plus: unlimited |
| Move tasks between lists; select and select all | 🟢 | |
| Smart order (overdue, due soon, priority), with pinning and reset | 🟢 / 🟡 | Drag-to-reorder across web and phone is the hard part |
| Folders for notes | 🟢 | |
| Location on tasks and notes, with "Open in Maps" | 🟢 | Mapbox or OpenStreetMap search |
| Recycle bin (30 days) | 🟢 | |
| Recurring tasks and subtasks | 🟡 | |
| Search and a ⌘K command palette | 🟡 | |
| Google Classroom import | 🔴 | Each school must approve it |

### Phase 3: quick wins

| Feature | Ease | Notes |
|---|---|---|
| Date, time and weather widget | 🟢 | Open-Meteo (free, no key) |
| Voice input button | 🟢 | Browser speech recognition (not Firefox); device dictation works everywhere already |
| Celebration when a real list is finished | 🟢 | At least 3 tasks, list at least about an hour old, done over time; follows the stimulation setting |
| Quotes (motivational and satirical), daily horoscope | 🟢 | Curated set + ZenQuotes; horoscope generated once a day per sign |
| Send tasks to any calendar as a file | 🟢 | `.ics`, Google and Outlook "add event" links |
| Visual focus timer | 🟢 | |
| Read aloud | 🟢 | Built-in browser and phone voices |

### Phase 4: calendar

| Feature | Ease | Notes |
|---|---|---|
| Calendar view of tasks with due dates | 🟢 | |
| Two-way Google Calendar sync | 🟡 | Up to 100 test users before Google's verification review (Plus) |
| Outlook and Teams calendar | 🟡 | Microsoft Graph (Plus) |
| iCloud calendar | 🔴 | No web API; use a subscription link, or the device calendar in the phone app |

### Phase 5: reminders and notifications

| Feature | Ease | Notes |
|---|---|---|
| Web push notifications | 🟡 | iPhone only after "Add to Home Screen" |
| Email reminders | 🟢 | Resend (3,000 free a month) |
| Reminder levels and quiet hours, time zones | 🟡 | Scheduled server jobs |

### Phase 6: AI

| Tier | What | Ease |
|---|---|---|
| Free, no AI service | List-type detection by keywords, templates, the existing task parser | 🟢 |
| Free, on-device | Browser built-in AI in desktop Chrome (support still changing); Apple's on-device AI in the iPhone app | 🟡 |
| Free, small daily allowance (you fund it) | Paragraph or pasted email → tasks; short task break-downs | 🟡 |
| Connected account or Plus | Chat helper, smart packing lists with weather, budget shopping picks, dream interpretation, long summaries, screenshot → tasks | 🟡 |

- Users connect their own AI through **OpenRouter sign-in** (one click) or by **pasting an API key** (OpenAI, Anthropic, Google AI Studio). Paid ChatGPT, Claude or Gemini subscriptions can't be used by other apps.
- Default model: Claude Opus 5.5. Claude Haiku 5.5 is an option for simple, high-volume jobs to cut costs.
- Not possible: pulling Google or DuckDuckGo AI summaries (no API, against their terms); Reddit and TripAdvisor data (paid or approval-only).

### Phase 7: admin panel

| Feature | Ease |
|---|---|
| Users: search, view, disable, change roles, export or delete data | 🟡 |
| Announcements: scheduled, aimed at user groups; feeds a "What's new" page | 🟢 |
| Feature switches and remote settings (no redeploy) | 🟡 |
| Email and push campaigns with opt-out | 🟡 |
| Analytics: active users, return rate, feature use, drop-off | 🟢 (PostHog) |
| AI usage and cost per user, adjustable limits | 🟡 |
| Audit log of admin actions | 🟢 |
| Feedback and support inbox | 🟢 |
| Maintenance mode, A/B tests | 🟢 |

### Phase 7.5: tiers and Stripe

See [Tiers and Stripe](#tiers-and-stripe). Adds a subscribers view to the admin panel. 🟡

### Phase 8: writing (notes, journal, dream journal)

| Feature | Ease | Notes |
|---|---|---|
| Formatting toolbar (font, colour, size, bold/italic/underline, highlight) | 🔴 | Tiptap on web, 10tap on phones; needs a new note format and a conversion for old notes |
| Note styles: sticky note, legal pad, dark, wall (marker or spray paint), whiteboard, concrete (chalk), comic thought bubble | 🟢 | Google Fonts (Permanent Marker, Caveat, Rock Salt, Bangers), CC0 textures |
| Journal with stationery presets (dot grid, graph, linen, kraft, vintage letter, botanical, minimalist, Y2K, travel, night sky) | 🟢 / 🟡 | Mood tag, daily prompt, streaks, full-screen writing, private lock |
| Dream journal: symbol guide and recurring-theme charts, no AI needed | 🟢 | Write the symbol guide ourselves (dream dictionaries are copyrighted) |
| Dream interpretation with AI | 🟡 | Plus; only sent when the user taps "Interpret" |
| Private journal mode (encrypted on the device) | 🔴 | Not even the server can read it; AI can't either; a lost passcode loses the entries |
| GIPHY in notes | 🟢 | Free key, "Powered by GIPHY", G/PG filter; paused in low-stimulation mode |
| Photos and screenshots in notes | 🟡 | File picker, paste, drag and drop; camera and library on phones; shrunk before upload; Supabase Storage (Plus storage limit) |
| Free image library | 🟢 | Unsplash or Pexels, with photographer credit |
| Dream journal as its own app | — | Not now; kept separate in the code so it can split off later |

### Phase 9: calculator suite

| Feature | Ease |
|---|---|
| Paper tape you can send to a note | 🟢 |
| Plain-English math ("15% of 82", "3 days from Friday") | 🟡 |
| Tip and bill splitting, with Venmo and Cash App links | 🟢 |
| Unit and currency conversion (Frankfurter, free) | 🟢 |
| Days between dates; loan and mortgage | 🟢 |
| Scientific mode (mathjs, never `eval`) | 🟡 |

### Phase 10: sharing, export, translation, pop-out

| Feature | Ease | Notes |
|---|---|---|
| Shared lists with live updates | 🟡 | Plus; Supabase Realtime |
| Share sheet (Messages, Mail, AirDrop), text and email links | 🟢 | |
| Print, PDF | 🟢 | Browser print; Expo print on phones |
| Image (PNG, JPG) | 🟢 | |
| TXT, Markdown, CSV | 🟢 | |
| Word (DOCX), which also opens in Pages | 🟡 | `docx` library (Plus) |
| Pages format directly | 🔴 | No tool writes Pages files; Word covers it |
| Google Drive | 🟡 | Narrowest Drive permission; can convert to a Google Doc (Plus) |
| Calendar file for Apple, Google, Outlook, Android | 🟢 | |
| Translate a note or list | 🟢 | Chrome's built-in translator; DeepL free plan elsewhere |
| Pop-out window that stays on top (Chrome, Edge) | 🟡 | Document Picture-in-Picture; a normal small window elsewhere |
| Always-on-top desktop app | 🔴 | Tauri or Electron, later |

### Phase 11: shopping

| Feature | Ease | Notes |
|---|---|---|
| Send a grocery list to Instacart | 🟡 | Apply for an Instacart developer key |
| Amazon cart | 🔴 | Only with exact Amazon product IDs |
| Budget-based item picks | 🔴 | Hand off to Goodfind |

### Phase 12: phone apps

| Feature | Ease | Notes |
|---|---|---|
| iOS and Android builds | 🟡 | EAS; Apple account $99/year |
| Phone push notifications, device calendar, on-device voice | 🟡 | |
| Home-screen widgets | 🔴 | |
| Location reminders ("when I get to the store") | 🔴 | |

---

## Tiers and Stripe

| Daypad Free | Daypad Plus (about $3–4 a month or $30 a year) |
|---|---|
| Tasks, up to 5 lists, notes, folders, journal | Unlimited lists, shared lists |
| Dream journal with the symbol guide and theme charts | Dream interpretation with AI |
| Calendar view, calendar file export, reminders | Two-way Google and Outlook sync |
| Voice input, read aloud, focus timer | |
| All accessibility features and onboarding preferences (always free) | |
| Free and on-device AI, a small daily allowance | AI included (no key needed); smart packing; screenshot → tasks |
| Export to TXT, PDF, image, calendar; download all your data (always free) | Word (DOCX) and Google Drive export |
| GIPHY | Photo uploads with more storage, stationery and texture packs |
| | Shopping integrations |

**How Stripe fits:** Checkout for paying, the customer portal for changing or cancelling, and a webhook that tells a
Supabase server function to update the user's plan. Test mode for the portfolio (test cards, no real charges).
About 2.9% + 30¢ per payment once live. Phone apps generally must use Apple and Google in-app purchases for digital
subscriptions; RevenueCat handles that (free for small apps).

---

## Security checklist

1. Sign-in: Google, GitHub, Microsoft, email; two-factor for everyone, required for admins
2. Row Level Security on every table; admin rights checked in the database; admin actions logged
3. HTTPS and Supabase disk encryption, plus encrypted sensitive fields (Vault)
4. Optional private journal encrypted on the device
5. Zod checks on all input; formatted notes cleaned before display (XSS); Content Security Policy
6. Rate limits on sign-in and AI; Cloudflare Turnstile on sign-up
7. Collect less: no typed text in analytics, personal details stripped from error reports
8. No secret keys in app code; GitHub secret scanning; Dependabot
9. Nightly backups
10. Data export, account deletion, retention rules
11. `SECURITY.md` and an OWASP Top 10 checklist

---

## Costs

| Item | Cost |
|---|---|
| Supabase, Vercel, PostHog, Sentry, Resend, Open-Meteo, GIPHY, Unsplash | Free tiers |
| Domain (optional) | About $12/year |
| Apple Developer account | $99/year (Apple sign-in, iPhone app) |
| Claude API | Pay per use; set a monthly cap |
| Stripe | Free to set up; fees per payment once live |

Free-tier catches: Vercel's free plan is non-commercial; Supabase pauses free projects after a week without activity and has no backups.
