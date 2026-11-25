# Daypad audit report

**Scope:** the version 2 rebuild of the 2023 to-do app, checked on the web build (development server and production export) at 375 × 667, 390 × 844, 420 × 860 and 1280 × 800, in light and dark mode.
**Date:** November 25, 2026

## Summary

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 18 of 18 passing |
| Type check (`tsc --noEmit`, strict) | No errors |
| Lint (`eslint`, Expo config with the React hooks rules) | No errors or warnings |
| `expo-doctor` | 20 of 20 checks passed |
| Console errors in the browser | None |
| Production web build | 1.7 MB of JavaScript (400 KB gzipped), 7 font files, 2.3 MB in total |

## The original app (version 1)

| Issue | Effect |
|---|---|
| `Platform` used without being imported | Crash on the line that sets keyboard behaviour |
| Blank tasks could be added | Empty rows in the list |
| Nothing saved | Every task was lost on restart |
| List keys were array indexes | Wrong rows could animate or keep stale state after a deletion |
| Expo SDK 46 and React Native 0.69 (2022) | No longer supported by current tooling |
| No accessibility labels, no dark mode, fixed 250 px input | Hard to use with a screen reader, on small phones or at night |

Version 2 replaces the app, so each of these is fixed by design. For example, `add()` ignores blank input and every row is keyed by a stable id.

## Found and fixed during testing

| # | Finding | Fix |
|---|---|---|
| 1 | Clicking a task's text toggled it. On the web, releasing a swipe also counted as a click, so swiping sometimes checked a task instead of deleting it. | Only the checkbox toggles. Press and hold the text to edit. |
| 2 | The page could shift sideways. The mesh gradient extends past the screen edge and the browser scrolled the clipped root to reveal it. | The backdrop, theme reveal, rows and screens now clip their own overflow. |
| 3 | The note editor sheet stopped above the tab bar, so its dim layer didn't cover the whole screen. | The editor and toasts render at the app root. |
| 4 | Toasts covered the task input and the reminder buttons in the note editor. | Toasts sit above the input on Tasks and move to the top while a note is open. |
| 5 | `autoFocus` did not fire while the note sheet was sliding in on the web, so typing after "Save tape" went nowhere. | The cursor is placed after the slide-in finishes. |
| 6 | Checkbox, tab and filter states weren't exposed to screen readers on the web (`aria-checked` was missing). | Switched to ARIA props, which React Native Web maps directly. |
| 7 | Screen readers read a hidden "Delete" label and "✓" on every row. | Both are hidden from accessibility. |
| 8 | On a 1280 × 800 window the bottom row of keys sat behind the tab bar. On a 375 × 667 phone the keys were too short to tap comfortably. | Keys are now flexible rows (46 to 76 points tall), with a compact display on short screens. |
| 9 | "Save result" was cut off on narrow phones. | That button gets more width and its text scales to fit. |
| 10 | Two tour steps highlighted the whole list, so the explanation card covered it. | The steps point at the first task or note. |
| 11 | Lint flagged `Date.now()` during render, which also meant "overdue" never updated while the app stayed open. | A `useNow()` hook refreshes the time every 30 seconds. |
| 12 | Every font weight in both families was bundled (4.1 MB build). | Only the 7 weights in use are imported (2.3 MB). |

## Known limits

- **Web reminders only fire while the tab is open.** Browsers can't schedule notifications for a closed page without a push server. Native builds use scheduled local notifications.
- **Native builds weren't run in a simulator for this audit.** The app was tested on the web. The native code paths (notifications, haptics, gestures) use Expo SDK 58 modules checked by `expo-doctor`, and the next step is a development build on iOS and Android.
- **Data stays on one device.** There is no account or sync. The persisted store shape (versioned with `persist`) is ready for a backend later.
