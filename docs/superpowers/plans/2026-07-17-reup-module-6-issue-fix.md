# Reup Module 6-Issue Fix — Implementation Plan

**Goal:** Fix 6 issues: video preview, real Whisper STT, FFmpeg filtergraph crash, one-click auto-complete, subtitle position control, API key persistence.

---

### Task 1: Fix Video Preview in Canvas (Issue 1)

**Files:** `src/components/VideoMaskCanvas.tsx`

- [ ] **Step 1**: Convert filesystem path to `file:///` URL in VideoMaskCanvas before passing to `<video src>`.
- [ ] **Step 2**: Run `npm run build` — verify PASS.
- [ ] **Step 3**: Commit.

---

### Task 2: Fix FFmpeg Filtergraph Crash (Issue 3)

**Files:** `electron/reupRenderer.js`

- [ ] **Step 1**: Rewrite `buildReupFFmpegArgs()` with correct filtergraph:
  - Build blur filter as separate chain: `[0:v]crop=...,boxblur=...[blur];[0:v][blur]overlay=...[v1]`
  - Chain subsequent filters (hflip, vignette, zoom) after blur output
  - Always map audio: when no voiceover, map `[0:a]` directly
- [ ] **Step 2**: Update unit test in `tests/reupRenderer.test.js` if needed.
- [ ] **Step 3**: Run `npm test` and `npm run build` — verify PASS.
- [ ] **Step 4**: Commit.

---

### Task 3: Add Real Whisper STT Integration (Issue 2)

**Files:** `electron/main.js`, `electron/preload.cjs`, `src/electron.d.ts`

- [ ] **Step 1**: Add `extract-video-speech` IPC handler in `main.js`:
  1. Use FFmpeg to extract audio from video to temp WAV
  2. Run `runWhisperLogic(wavPath, useCloud)` 
  3. Group words into sentence segments with timestamps
  4. Return `{ success, segments: [{id, start, end, text}] }`
- [ ] **Step 2**: Add `extractVideoSpeech` binding in `preload.cjs`.
- [ ] **Step 3**: Add type declaration in `electron.d.ts`.
- [ ] **Step 4**: Run `npm run build` — verify PASS.
- [ ] **Step 5**: Commit.

---

### Task 4: Update ReupScreen — Real STT, Auto-Complete, Subtitle Position, API Persistence (Issues 2,4,5,6)

**Files:** `src/components/ReupScreen.tsx`

- [ ] **Step 1**: Add `localStorage` persistence for `apiKey`, `endpointUrl`, `provider` (Issue 6):
  - Load from localStorage on mount via `useEffect`
  - Save to localStorage on every change via `useEffect`

- [ ] **Step 2**: Replace mock data with real Whisper call (Issue 2):
  - Call `window.electronAPI.extractVideoSpeech(videoFile.path)` 
  - Feed extracted segments to `translateSegments()`

- [ ] **Step 3**: Add subtitle position UI control (Issue 5):
  - Add radio/button group for subtitle position (`bottom`, `center`, `top`)
  - Pass `subtitlePos` into `renderReupVideo` params

- [ ] **Step 4**: Add "Tự Động Hoàn Tất" one-click button (Issue 4):
  - Sequential pipeline: extract → translate → render
  - Show progress phase text during each step

- [ ] **Step 5**: Run `npm test` and `npm run build` — verify PASS.
- [ ] **Step 6**: Commit.
