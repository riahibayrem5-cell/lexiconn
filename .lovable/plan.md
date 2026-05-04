## General audit — what's incomplete, broken, or missing

After reading every page, the sidebar, the layout, types, and the storage layer, here's the honest state of the app.

### Bugs / dead code
1. **`Constellation` page is orphaned** — fully built (force-graph of book connections) but not in `App.tsx` routes and not in the sidebar. Either ship it or delete it.
2. **`/quotes`** has an unused `cardRef` and an "AI Card" button that calls a Lovable AI image function on every click — slow and expensive. The fallback SVG is also better-looking than the AI version.
3. **`Ritual`** ignores `pagesStart/pagesEnd` mid-session (only used at stop), and the "Mid-session capture" quote button doesn't disable while empty.
4. **`Review` page** is just a 12-item priority list — barely a page.
5. **`Archive`** estimates hours as `pages * 2 / 60` — that's pages-as-minutes, weird formula, should use a real WPM model + actual logged session minutes.
6. **`Oracle`** and **`Recommendations`** overlap heavily (both do AI search + add-to-shelf). Users will be confused which one to use.
7. **AdminPanel** still lists `/admin` as a togglable nav item (you can hide the page that hides itself).
8. **Sidebar** "Sign in to sync" label shows even after sign-in for one frame because `user` resolves async — minor flicker.
9. **No global empty-state** for first-time visitors landing on `/` with zero books — they see "An empty shelf is a kind of patience." but no onboarding.
10. **No keyboard shortcuts** anywhere (a luxury reading app should have a `⌘K` palette at minimum).

### Missing features that the app clearly wants
- **Reading goals** (yearly book target, weekly minutes target). Ritual already tracks streaks but there's no target line.
- **Currently reading widget** on the home/shelf — right now the only way to resume is to scroll the "Reading" shelf.
- **Per-book progress %** (we have pagesStart/pagesEnd in sessions and `pages` on the book — easy to compute).
- **Quotes → share image** that's actually shareable (Twitter/IG-sized PNG, copy-to-clipboard, not just download).
- **Search across everything** (books, quotes, journal entries) from one place.
- **Book detail "Reading timeline"** — sessions exist as data but BookBrain doesn't visualize them.
- **Recommendations history is per-search but not connected to "books you've already added"** — it should mark editions you own.
- **Export to Markdown / Notion-friendly** in addition to JSON.

### Things to consider getting rid of
- **`AdminPanel`** (`/admin`) — overlaps with `Settings`, exposes confusing knobs (premium depth slider, page header copy editors). Most users will never touch it. **Recommend folding into Settings under an "Advanced" accordion** and removing the sidebar entry.
- **`LibrarianAgent`** (floating chat) — duplicates the Oracle + Recommendations flows and is a heavy bundle. Keep the toggle but default it OFF, and trim its command surface.
- **The 4-mode `Oracle` page** — keep "What Next" only; "Thematic Threads", "Author Universe", "Compare" should move into BookBrain (per-book dossier), where they belong.

---

## Two-day plan

### Day 1 — Fix the foundations & ship dead pages

**A. Routing & navigation cleanup**
- Add `/constellation` route and sidebar entry for `Constellation`.
- Remove `/admin` from sidebar; keep route reachable but fold the panel content into a Settings → Advanced section.
- Add a `CommandPalette` (⌘K / Ctrl-K) that searches books, quotes, navigates pages, and triggers actions (add book, start ritual, etc.). Single keyboard-driven interface to replace the floating agent.
- Default the floating `LibrarianAgent` to OFF in `adminSettings` (still toggleable).

**B. Home / Shelf upgrades**
- Above the shelf, add a **"Currently at the desk"** strip: the active reading book(s) with cover, % progress (computed from latest session pagesEnd / book.pages), last opened, and a "Resume in Ritual" button.
- Add a **"Today" bar**: minutes read today, streak, weekly goal progress.
- First-visit empty state: replace the single line with a guided card (Add a book / Import from Goodreads / Browse demo shelf).

**C. Bug fixes**
- Remove unused `cardRef` and dead AI Card path in Quotes — keep the SVG fallback as the primary, rename to "Download card" and add a "Copy as image" button using `canvas`.
- Fix Ritual's pages-on-stop logic so it computes pace from the real logged session, not from inputs that may be empty.
- Fix Archive `hours` estimate: use sum of session.durationMin where present; fall back to `pages / 0.5` (≈ 2 min/page) only when no sessions.
- Sidebar: render the avatar/label only after the auth state resolves to avoid the "Sign in" → "Display name" flicker.

### Day 2 — Add missing surfaces & consolidate

**D. Reading goals & progress**
- New `Goal` types in `lib/types.ts`: `{ year, books, minutesPerWeek }`.
- Persist in `profiles` for signed-in users, localStorage for guests.
- Show goal rings on Ritual (weekly minutes) and Archive (yearly books).
- Add a per-book progress % chip on every spine hover-card and in BookBrain header.

**E. BookBrain dossier upgrades**
- New "Timeline" tab: vertical list of sessions + journal entries + quotes interleaved by date, like a reading diary.
- Move Oracle's "Thematic threads" and "Compare with another book" features here as in-context AI actions ("Find books like this in my library", "Compare with…").
- Add a **Reading-timeline mini-chart** (sparkline of cumulative pages over time).

**F. Quotes & sharing**
- Replace the AI quote-card with a deterministic, beautiful client-side canvas card (3 templates). Buttons: Download PNG, Copy to clipboard, Share (Web Share API where available).
- Add tag-cloud filters to the Quotes page (by book, by resonance, by year saved).

**G. Consolidate Oracle / Recommendations**
- `Oracle` → keep only "What Next" mode, rename to **Concierge** (recommends from your library + mood).
- Multi-language editions stays as the **Recommendations** page (already strong).
- Cross-link both: Recommendations result page shows "Ask the Concierge about this book" button.

**H. Constellation polish (since we're shipping it)**
- Replace the orbital init with a deterministic seed so layout doesn't jitter on every render.
- Add filters above the canvas: by status, by tag, by arc outcome.
- Click a node → side drawer with the book mini-dossier instead of a hard navigation.

**I. Export upgrades**
- Add Markdown export (one .md per book with quotes + journal) zipped via JSZip.
- Add a "Copy quote as Markdown" button on every quote card.

---

## Technical notes

- **Command palette**: use `cmdk` (already a transitive dep via shadcn). New file `src/components/CommandPalette.tsx`, mounted in `AppLayout`, opens on `keydown` `Meta+K` / `Ctrl+K`.
- **Goals storage**: extend `profiles` table with `reading_goal_books int`, `reading_goal_minutes_per_week int`. Migration needed. Guest fallback in `localStorage` under `lexicon:goals`.
- **Progress %**: helper `bookProgress(book): number` in `lib/storage.ts` that picks the latest session's `pagesEnd` divided by `book.pages`.
- **Quote canvas**: pure client-side `OffscreenCanvas` (or fallback `<canvas>`); 1080×1080 output; no edge function call. Removes the `quote-card` function from the hot path.
- **Constellation**: extract the simulation loop into `useConstellationLayout(books)` hook so the page component is render-pure; gate label rendering with `requestIdleCallback`.
- **AdminPanel fold-in**: move its content into a new `<SettingsAdvanced/>` accordion in `Settings.tsx`; delete the standalone page or leave a redirect.
- **No new dependencies** beyond what's already shadcn-bundled.

```text
Sidebar (after)
├─ Shelf
├─ Concierge          (renamed Oracle, single mode)
├─ Recommendations    (multi-language editions)
├─ Reading Ritual
├─ Quotes Vault
├─ Constellation      (NEW visible)
├─ Archive
├─ Review Desk
└─ Settings           (Admin folded in here)
```

---

## Open questions for you

I'll ask before starting Day 1 so I don't go the wrong direction on the bigger calls (consolidating Oracle, dropping AdminPanel, defaulting the floating agent off). If you'd rather I just proceed with my judgement, say "go" and I'll execute the full two-day plan.