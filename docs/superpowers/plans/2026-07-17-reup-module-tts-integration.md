# Reup Module TTS & Progress Bar — Implementation Plan

**Goal:** Implement AI TTS dubbing and render progress bar.

---

### Task 1: Update FFmpeg Arguments Builder (Issue 1)

**Files:** `electron/reupRenderer.js`

- [ ] **Step 1**: Update `buildReupFFmpegArgs` to accept `voiceoverSegments` array of `{ path, start }` instead of single `voiceoverAudioPath`.
- [ ] **Step 2**: Delay each voiceover segment with `adelay` (using milliseconds) and mix them with `amix` to construct `[voiceover_mixed]`.
- [ ] **Step 3**: Mix `[voiceover_mixed]` with `[bgmInputIdx:a]` if BGM is active.
- [ ] **Step 4**: Run `npm test` — verify PASS.
- [ ] **Step 5**: Commit.

---

### Task 2: Implement Main Process Handlers & Progress Parsing (Issue 2)

**Files:** `electron/main.js`

- [ ] **Step 1**: Implement `reup-generate-voiceover` handler to synthesize MP3 for each segment sequentially using Chirp.
- [ ] **Step 2**: Update `render-reup-video` to:
  - Get input video duration using `getVideoDuration`.
  - Listen to FFmpeg stderr, parse progress `time=`, calculate percentage and ETA, and emit `reup-render-progress` event.
- [ ] **Step 3**: Clean up temporary TTS segment files in `finally` block of `render-reup-video`.
- [ ] **Step 4**: Run `npm run build` — verify PASS.
- [ ] **Step 5**: Commit.

---

### Task 3: Expose Preload & Typings (Issue 3)

**Files:** `electron/preload.cjs`, `src/electron.d.ts`

- [ ] **Step 1**: Register `generateReupVoiceover` and `onReupRenderProgress` in `preload.cjs`.
- [ ] **Step 2**: Add typings for them in `src/electron.d.ts`.
- [ ] **Step 3**: Run `npm run build` — verify PASS.
- [ ] **Step 4**: Commit.

---

### Task 4: Connect UI Controls & Progress Bar (Issue 4)

**Files:** `src/components/ReupScreen.tsx`

- [ ] **Step 1**: Add TTS configuration: checkbox "Lồng tiếng AI (TTS)", Voice dropdown populated with standard voices for selected reup target language.
- [ ] **Step 2**: Save/restore selected TTS checkbox and Voice in `localStorage`.
- [ ] **Step 3**: Connect rendering progress listener to state `renderProgress` and `renderEta`. Show a premium progress bar when `isRendering` is true.
- [ ] **Step 4**: Update `handleRenderReup` and `handleAutoComplete` to trigger `generateReupVoiceover` if TTS is enabled, then pass generated segments to rendering.
- [ ] **Step 5**: Run `npm test` and `npm run build` — verify PASS.
- [ ] **Step 6**: Commit.
