# Ideas — Voice-Notes App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A real, durable, single-user glassmorphism voice-notes app for capturing creative ideas — record → auto-transcribe → AI-organize — installed on the owner's iPhone and used daily.

**Architecture:** Expo (managed) + expo-router app. All data is local in SQLite (no backend, no auth). Recording via `expo-audio`; transcription via OpenAI Whisper; auto-title + analysis + chat via the Anthropic API, both called directly from the device. API keys live in the iOS Keychain (`expo-secure-store`), entered once in Settings — never in git or the app bundle. The entire dev loop runs in **Expo Go** on the phone (all native modules used are bundled in Expo Go); only the final installable build goes through **EAS cloud build** (no Mac needed).

**Tech Stack:** Expo SDK (latest) · expo-router · TypeScript · expo-blur · expo-linear-gradient · react-native-reanimated · react-native-gesture-handler · expo-haptics · expo-audio · expo-sqlite · expo-secure-store · expo-file-system · zustand · Jest + @testing-library/react-native

**Design reference:** Ann Wyn's liquid-glass UI (https://x.com/ann_nnng/status/2064551182748762620) and Dribbble Glass Badge Pack (shot 16477143). Concrete glass tokens defined in Phase 1; validate against the reference during the Gate-1 review.

---

## Ground rules for the engineer

- **Windows + Git Bash.** If an interactive Expo/EAS prompt hangs under mintty, prefix with `winpty` (e.g. `winpty eas login`). Escape leading-slash flags with `//` if Git Bash mangles a path.
- **Test what has logic, verify what has pixels.** TDD the pure modules (db, api clients, parsers, formatters) with Jest. UI/animation correctness is checked manually on the phone at the numbered **Gates** — don't write brittle snapshot tests for glass.
- **Commit after every green task.** Small diffs.
- **DRY / YAGNI.** Everything routes through the `theme` and the data layer. No feature not in this plan.
- **Secrets never touch git.** Keys go in `expo-secure-store` at runtime. `.gitignore` covers `.env*`.

---

## Phase 0 — Project setup & pre-flight

### Task 0.1: Accounts & keys (manual, do first)
Confirm you have, before writing code:
- [x] OpenAI API key (Whisper) — verified working (env + `./.env`)
- [x] Anthropic API key — verified working, Haiku (`./.env`; **$2 credit → Haiku for ALL AI calls, analysis and chat**)
- [x] Expo account — logged in as `az9713`
- [x] ~~Apple Developer Program~~ — **not used**; $0 Expo Go + EAS Update path (see Phase 11)
- [x] **Expo Go** installed on the iPhone
- [x] Node v22 + eas-cli 19.1 in Git Bash

Keys are entered in the app later (Settings), so nothing to store yet.

### Task 0.2: Scaffold the project

```bash
cd /c/Users/simon/Downloads/fable_5_mobile_app_pat_simmons
npx create-expo-app@latest app --template default   # TypeScript + expo-router
cd app
git init && git add -A && git commit -m "chore: scaffold expo app"
```
Move/keep the plan and `.ignore/` at repo root; the Expo app lives in `app/`.

### Task 0.3: Install dependencies

```bash
npx expo install expo-blur expo-linear-gradient react-native-reanimated \
  react-native-gesture-handler expo-haptics expo-audio expo-sqlite \
  expo-secure-store expo-file-system expo-crypto
npm i zustand
npm i -D jest jest-expo @testing-library/react-native @types/jest better-sqlite3 @types/better-sqlite3
```

`expo-crypto` provides `randomUUID()` (Hermes has no `crypto.randomUUID`). `better-sqlite3` is **test-only**: expo-sqlite is a native module and cannot execute SQL under Jest in Node, so repo tests run the same SQL against better-sqlite3 through a thin adapter (Task 2.2).

### Task 0.4: Config

**Files:**
- Modify: `app/app/_layout.tsx` — wrap the root layout in `<GestureHandlerRootView style={{flex:1}}>` (required for the Phase 8 drawer gestures; the template does not add it).
- Modify: `app/package.json` — add `"test": "jest"`, `"jest": { "preset": "jest-expo" }`.
- **Note:** do NOT create/edit `babel.config.js` — since SDK 50, `babel-preset-expo` auto-configures the Reanimated plugin, and the template ships without a babel config.
- Modify: `app/app.json` —
  - `expo.ios.infoPlist.NSMicrophoneUsageDescription`: "Record your voice notes."
  - `expo.ios.bundleIdentifier`: `com.<you>.ideas`
  - `expo.name`: "Ideas", `expo.scheme`: "ideas"
- Create: `app/.gitignore` additions — `.env*`, `*.sqlite`.

**Verify:** `npx expo start` → open in Expo Go → default screen loads. **Commit.**

---

## Phase 1 — Design system (the glass foundation)

> This is the load-bearing phase. Every screen is built against these tokens so the glass stays consistent and the look is tunable in one place.

### Task 1.1: Theme tokens

**Files:** Create `app/src/theme/theme.ts`

```ts
export const theme = {
  color: {
    textPrimary: 'rgba(255,255,255,0.96)',
    textSecondary: 'rgba(255,255,255,0.66)',
    textFaint: 'rgba(255,255,255,0.40)',
    record: '#FF5A5F',          // warm translucent record accent
    recordGlow: 'rgba(255,90,95,0.45)',
  },
  glass: {
    fill: 'rgba(255,255,255,0.10)',
    fillElevated: 'rgba(255,255,255,0.16)',
    fillPressed: 'rgba(255,255,255,0.22)',
    border: 'rgba(255,255,255,0.22)',
    borderStrong: 'rgba(255,255,255,0.35)',
    blurIntensity: 45,          // expo-blur
    blurTint: 'light' as const,
  },
  radius: { sm: 16, md: 24, lg: 28, xl: 32, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    // iOS
    shadowColor: '#000', shadowOpacity: 0.18,
    shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },
  font: { title: 28, heading: 20, body: 16, small: 13, weightSemi: '600' as const },
} as const;
export type Theme = typeof theme;
```

**Commit.**

### Task 1.2: `GlassCard` component (the reusable frosted surface)

**Files:** Create `app/src/components/GlassCard.tsx`

Wrap `BlurView` (expo-blur) with: a translucent fill overlay (for color control on top of blur), a 1px `theme.glass.border`, `theme.radius.*` corners, and a top **sheen** — an `expo-linear-gradient` from `rgba(255,255,255,0.25)` → transparent over the top third — which is what sells the "liquid glass" highlight. Accept `radius`, `intensity`, `style`, `pressed` props. `overflow:'hidden'` so blur clips to the radius.

Key structure:
```tsx
<View style={[shadow, {borderRadius}]}>
  <BlurView intensity={intensity} tint="light" style={{borderRadius, overflow:'hidden'}}>
    <LinearGradient colors={['rgba(255,255,255,0.25)','transparent']} .../>  {/* sheen */}
    <View style={{backgroundColor: pressed? fillPressed : fill, borderWidth:1, borderColor: border, borderRadius}}>
      {children}
    </View>
  </BlurView>
</View>
```

**Gate check (visual):** render a `GlassCard` over a photo background in Expo Go; compare frost/border/sheen against Ann's reference. Tune `blurIntensity`, `fill`, and sheen opacity until it matches. **Commit.**

### Task 1.3: Background system

**Files:**
- Create `app/assets/backgrounds/` — bundle 3–4 curated **public-domain** impressionist/pointillist paintings (e.g. Seurat, Monet, Van Gogh) downloaded from Wikimedia Commons, plus one iridescent gradient fallback. ~1200px wide, compressed.
- Create `app/src/components/Background.tsx` — full-screen `ImageBackground` with a dark scrim (`rgba(0,0,0,0.25)`) so glass and white text read on any painting. Reads the selected background id from the settings store.

Bundling (not runtime-fetching) keeps the app instant and offline. Settings picker (Phase 9) switches between them.

**Commit.**

---

## Phase 2 — Data layer (SQLite)

> TDD this fully. It's the durability guarantee — a note captured today must be there next year.

### Task 2.1: Schema + migration

**Files:** Create `app/src/db/schema.ts`, `app/src/db/db.ts`

Schema:
```sql
CREATE TABLE folders (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,  -- NULL = Inbox
  title TEXT NOT NULL,
  summary TEXT, next_steps TEXT,        -- next_steps = JSON array
  audio_uri TEXT,                        -- local file (nullable)
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE segments (                  -- one row per recording (original + each "add to note")
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  text TEXT NOT NULL, audio_uri TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE messages (                  -- chat-with-note history
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```
`db.ts` opens `expo-sqlite`, runs migrations (a `user_version` pragma bump pattern), enables `PRAGMA foreign_keys = ON`.

**Testing strategy (applies to all of Phase 2):** expo-sqlite is a native module — it cannot run SQL under Jest in Node. Define a ~5-method adapter interface (`run`, `all`, `get`, `exec`, `pragma`) in `app/src/db/adapter.ts`; `db.ts` implements it over expo-sqlite (used by the app), tests implement it over **better-sqlite3 in-memory** (same SQLite dialect, real SQL execution). Schema, migrations, and every repo function are written against the adapter, so the tests exercise the identical SQL the phone runs.

**Test** (`app/src/db/__tests__/db.test.ts`): open in-memory better-sqlite3 adapter, run migration, assert all four tables exist and `foreign_keys` is on. Run → fail → implement → pass. **Commit.**

### Task 2.2: Repository functions

**Files:** Create `app/src/db/repo.ts` — pure functions over the db handle:
`createFolder(name)`, `listFolders()`, `createNote({folderId, title, ...})`, `getNote(id)`, `listNotes(folderId|null)`, `updateNote(id, patch)`, `moveNote(id, folderId)`, `addSegment(noteId, text, audioUri)`, `listSegments(noteId)`, `addMessage(noteId, role, content)`, `listMessages(noteId)`, `deleteNote(id)`.

Use `randomUUID()` from `expo-crypto` for ids (Hermes has no built-in `crypto.randomUUID`); `Date.now()` for timestamps. In tests, inject a UUID factory so repo functions stay runnable under Node.

**Test:** for each: create → read back → assert. Cover `moveNote`, cascade delete (deleting a note removes its segments+messages), and Inbox = `folder_id IS NULL`. TDD each. **Commit per function group.**

### Task 2.3: Store (zustand) + hooks

**Files:** Create `app/src/store/useStore.ts` — holds `folders`, `notes` cache, `selectedBackgroundId`, and actions that call `repo` then refresh. Screens subscribe. Keep it thin. **Commit.**

### Task 2.4: Secret storage (moved up from Phase 9 — Phase 4/5/8 need keys to test)

**Files:** Create `app/src/store/secrets.ts` — `getKey(name)/setKey(name, value)` over `expo-secure-store` (iOS Keychain) for `openai` and `anthropic`. **Dev fallback:** if Keychain has no value, `getKey` falls back to `process.env.EXPO_PUBLIC_OPENAI_KEY` / `EXPO_PUBLIC_ANTHROPIC_KEY` from a git-ignored `app/.env` — so the capture pipeline is testable in Expo Go long before the Settings UI exists. All AI calls read keys only through this module.

> **Security decision (documented):** keys live in the device Keychain, entered once via Settings (Phase 9) — never in git or the shipped bundle. `EXPO_PUBLIC_` env vars are a **dev-only** convenience (they do get inlined into dev JS bundles, which is fine for a local Expo Go session; the `eas build` in Phase 11 must be run without them set, relying on Keychain only). Upgrade path if the app ever leaves this one phone: a thin serverless key proxy. `// ponytail: keychain + dev env fallback; add a proxy only if the app gets other users`

**Test:** fallback logic only (Keychain empty → env value; Keychain set → Keychain wins) with expo-secure-store mocked. **Commit.**

---

## Phase 3 — Home screen (Gate 1)

> **Gate 1: Home screen live on the phone.** Glass locked, record button is the hero and clickable, folder grid renders. Stop and review the design before continuing.

### Task 3.1: Layout

**Files:** Create `app/app/index.tsx`, `app/src/components/RecordButton.tsx`, `app/src/components/FolderTile.tsx`

- `<Background>` → `<SafeAreaView>`.
- **RecordButton is the focal point**: large translucent pill/circle (`GlassCard` with `record` accent), centered high. Idle = calm; recording = a Reanimated "throb" (scale 1↔1.06 loop) + `recordGlow` shadow. `expo-haptics` `impactAsync(Medium)` on start, `Heavy` on stop.
- **Folder grid beneath**: 2-column grid of `FolderTile` (`GlassCard`, folder name + note count). First tile is always **Inbox**. A dashed "＋ New folder" tile opens a create modal.
- Tapping a folder → `router.push('/folder/'+id)`.

Wire RecordButton's press to Phase 4's recording hook (stub until then — logs state).

**Gate 1 verification:** run in Expo Go on the phone. Confirm: glass matches reference, record button throbs and haptics fire, grid + Inbox + New-folder work, folder tap navigates. **Commit. Check in with owner.**

---

## Phase 4 — Recording → transcription pipeline

### Task 4.1: Recording hook

**Files:** Create `app/src/audio/useRecorder.ts` using `expo-audio` — request mic permission, start/stop, return the recorded file uri (m4a) and a `state` (`idle|recording|processing`). Haptics on transitions.

**Durability:** expo-audio records into the **cache** directory, which iOS may purge. On stop, move the file to `FileSystem.documentDirectory + 'audio/'` (this is what `expo-file-system` is installed for) and store that uri — document dir is permanent and included in iCloud device backups, same as the SQLite db.

**Manual verify:** record 5s on the phone, confirm a playable file uri under `documentDirectory` is produced. (Hardware — verify on device, not in a unit test.)

### Task 4.2: Whisper client

**Files:** Create `app/src/ai/whisper.ts`

```ts
export async function transcribe(audioUri: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri: audioUri, name: 'note.m4a', type: 'audio/m4a' } as any);
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  return (await res.text()).trim();
}
```
Add `formatParagraphs(text)` — split runaway text into paragraphs on sentence boundaries / long pauses so notes are never a wall of text (PRD 4.2).

**Test** (`whisper.test.ts`): mock `fetch`; assert correct URL/headers/multipart and that a non-200 throws. Test `formatParagraphs` on a long unbroken string → multiple paragraphs. TDD. **Commit.**

### Task 4.3: Capture flow

Wire home RecordButton: stop → `state=processing` → `transcribe` → create a note in **Inbox** with the transcript as its first `segment`, a temporary title, then trigger Phase 5 analysis. Show a processing state on the button. Error → non-blocking toast, keep the audio so nothing is lost (silent-failure guard). **Commit.**

---

## Phase 5 — AI analysis + auto-title

### Task 5.1: Anthropic client

**Files:** Create `app/src/ai/anthropic.ts`

```ts
const URL = 'https://api.anthropic.com/v1/messages';
const HEADERS = (k: string) => ({
  'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
});
export async function analyze(transcript: string, apiKey: string) {
  const res = await fetch(URL, { method:'POST', headers: HEADERS(apiKey), body: JSON.stringify({
    model: 'claude-haiku-4-5', max_tokens: 600,
    system: 'Return ONLY minified JSON: {"title": string (<=6 words), "summary": string (2-3 sentences), "next_steps": string[]}. No prose.',
    messages: [{ role:'user', content: transcript }],
  })});
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return parseAnalysis(data.content[0].text);   // robust JSON extract
}
```
`parseAnalysis` strips code fences, `JSON.parse`, and on failure falls back to `{title:'Untitled idea', summary:'', next_steps:[]}` (never crash a saved note over a formatting hiccup).

**Test:** mock fetch; assert headers/body; feed a fenced-JSON string to `parseAnalysis` → parsed; feed garbage → safe fallback. TDD. **Commit.**

### Task 5.2: Wire analysis into capture

After transcript saved, call `analyze`, `updateNote` with title/summary/next_steps. Runs async — the note appears immediately in Inbox and fills in analysis when ready. **Commit.**

---

## Phase 6 — Folder screen & note list (Gate 2 begins)

### Task 6.1: Folder screen

**Files:** Create `app/app/folder/[id].tsx`, `app/src/components/NoteRow.tsx`
- Header = folder name; `FlatList` of `NoteRow` (icon · title · date), each a slim `GlassCard` **with `blur={false}`** — a per-row `BlurView` in a scrolling list kills frame rate on device; rows use the translucent fill + border + sheen only (visually near-identical over a scrim), real blur is reserved for the few large surfaces (record button, folder tiles, drawer). Add the `blur?: boolean` prop to `GlassCard` in Task 1.2.
- Native open/close feel: screen-transition spring; row press-in scale. Long-press a row → "Move to…" sheet (folder picker) → `moveNote`. Haptics on move.
- Tap row → `router.push('/note/'+id)`.

**Verify on phone:** navigate in/out, list scrolls smoothly, move works. **Commit.**

---

## Phase 7 — Note detail + add-to-note

### Task 7.1: Note detail

**Files:** Create `app/app/note/[id].tsx`
- Top: title + date + **AI analysis** card (summary + next-steps list) — the topline overview.
- Below: transcript shown **collapsed** with an expand chevron; expanding animates height via Reanimated (`Layout`/`measure`), doesn't pop. Multiple segments render stacked (original + each appended block, each labeled with its time).
- **Add to note**: a record button (reuse `useRecorder`) → transcribe → `addSegment` → new block springs in. Haptics on commit.
- Buttons: "Chat with this note" (Phase 8), expand/collapse.

**Verify:** expand animates, append adds a block live. **Commit.**

---

## Phase 8 — Chat with note (Gate 2 continues)

### Task 8.1: Chat drawer

**Files:** Create `app/src/components/ChatDrawer.tsx`
- Gesture-driven bottom sheet (`react-native-gesture-handler` + Reanimated) with real slide physics; haptics on open/close.
- Input **pre-seeded** with a prompt (PRD 4.7): "What were the next steps from this?" / "What was the idea as a whole?".
- On send: `addMessage(user)`, call `anthropic.chat(messages, noteTranscript, apiKey)` with the full transcript as system context, `addMessage(assistant)`, persist. History reloads from `messages` table so chats survive app restarts.

### Task 8.2: `chat()` in anthropic.ts
Non-streaming v1 (simpler, robust). Add `chat(history, transcript, apiKey)`. **Test** message-shaping (system carries transcript, history maps to roles). TDD. **Commit.**

> **Gate 2: all screens.** Review the full flow on the phone — capture → Inbox → analysis → folder filing → detail/expand → append → chat. Check in with owner before polish.

---

## Phase 9 — Settings (API keys, background, backup)

*(Secure key storage itself was built in Task 2.4 — this phase is the UI over it.)*

### Task 9.1: Settings screen

**Files:** Create `app/app/settings.tsx` — two secure inputs (paste OpenAI + Anthropic keys, masked, writing via `secrets.setKey`), a "test keys" button (tiny ping to each API), and the **background picker** (thumbnails of bundled paintings → sets `selectedBackgroundId`). A first-run banner routes here if keys are missing. **Commit.**

### Task 9.2: Export / backup

This phone is the only copy of every idea — a keep-forever app needs an escape hatch.

**Files:** Create `app/src/export/exportNotes.ts` + a Settings button "Export all notes".
- Serialize all folders/notes/segments (+ chat optional) to a single Markdown file (one `#` section per note, metadata line, transcript blocks) and a `notes.json` alongside.
- Write both to a temp file and hand off via the iOS **share sheet** (`expo-sharing` — `npx expo install expo-sharing`) → AirDrop / Files / iCloud Drive.

**Test:** the serializer is pure — feed fixture folders/notes/segments, assert the Markdown structure and that JSON round-trips. TDD. **Commit.**

---

## Phase 10 — Polish pass

- Haptics audit: every state change (record start/stop, save, drawer, append, expand, move) fires the right weight.
- Animation tuning: spring configs consistent; no jank on the phone.
- Empty states: empty Inbox, empty folder, no-keys.
- Loading/error states for every network call (transcribe, analyze, chat) — visible, non-destructive, audio never lost.
- App icon + splash (fix the off-center icon the video complained about).

**Commit per fix. Gate: full manual pass on the phone.**

---

## Phase 11 — Deploy to your iPhone ($0 path: Expo Go + EAS Update, no Apple Developer Program)

> **Decision:** owner opted out of the $99 Apple Developer Program. Without it (and with no Mac), a standalone home-screen app is not possible — so the app lives **inside Expo Go** permanently, loaded from a published EAS Update (free tier). Trade-offs, accepted: launch is "open Expo Go → tap Ideas" instead of a home-screen icon; the installed Expo Go's SDK version must match the project's (after Expo Go auto-updates from the App Store, a republish on the new SDK may occasionally be needed). Upgrade path if this ever annoys: pay the $99 and restore the original standalone-build flow (kept dormant below).

### Task 11.1: Configure EAS Update
```bash
cd app
winpty eas update:configure     # wires expo-updates + project ID into app.json
git add -A && git commit -m "chore: eas update config"
```

### Task 11.2: Publish
```bash
eas update --branch production --message "v1"
```
Run this **without** any `EXPO_PUBLIC_*` key vars in the environment / `.env` (see Task 2.4) — the published bundle must rely on Keychain-entered keys only.

### Task 11.3: Open on the iPhone
1. Open **Expo Go**, sign in as `az9713` (same account the CLI is logged into).
2. The project appears under **Projects** → tap it → the published update loads.
3. Enter both API keys in Settings, grant mic permission, record a real note, confirm transcript + analysis land. The last-loaded update is cached, so the app opens and works without the PC running.

**Ship.** Updating later = re-run `eas update` (seconds, no build queue).

### Data durability note (Expo Go specifics)
SQLite + audio live in Expo Go's per-project sandbox — they persist across launches and phone reboots, but **deleting Expo Go (or clearing the project's data) deletes every note**. This makes Task 9.2's export button non-optional: export after any serious capture session. iCloud device backup does include Expo Go's data.

### Dormant: standalone install (if the $99 is ever paid)
`eas device:create` → install provisioning profile on phone → `eas build --platform ios --profile preview` (in `eas.json`: `"distribution": "internal"`) → install from the build URL. No code changes needed — only this deploy step swaps.

---

## What's deliberately NOT in v1 (YAGNI)
- No auth, no cloud sync, no Supabase (single device; SQLite is the source of truth).
- No native on-device speech (Whisper keeps the whole dev loop in Expo Go on Windows).
- No drag-and-drop folder reordering (long-press "Move to…" covers filing).
- No streaming chat (non-streaming is simpler and fine for note-length context).
- No App Store / TestFlight (internal distribution only).

Add each only when the app is in daily use and the gap actually bites.

---

## Defaults adopted (say the word to change any)
1. **Backgrounds:** bundle 3–4 curated public-domain paintings (no runtime Wikimedia fetch) — faster, offline.
2. **Model:** `claude-haiku-4-5` for **everything** — per-note analysis AND chat-with-note (owner has $2 API credit; one constant in `anthropic.ts` if ever bumped). Keep `max_tokens` tight (600 analysis / 1000 chat).
3. **Backup:** export-to-Markdown/JSON via the share sheet is now Task 9.2 (promoted from "open item" — a keep-forever app on one phone needs an escape hatch).
