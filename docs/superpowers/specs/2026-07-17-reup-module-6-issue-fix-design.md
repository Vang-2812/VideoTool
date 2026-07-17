# Design Specification: Reup Module – 6-Issue Fix & Enhancement

## 1. Overview
Fix 6 issues in the Reup Video module: video preview not rendering, Step 1 using mock data instead of real Whisper STT, FFmpeg filtergraph crash, missing one-click auto-complete flow, missing output subtitle positioning, and API key persistence.

---

## 2. Issue Analysis & Solutions

### Issue 1: Video not displaying in Canvas
**Root Cause**: `VideoMaskCanvas.tsx` passes raw filesystem path (e.g. `C:\Users\...\video.mp4`) to `<video src>`. Chromium in Electron blocks loading raw paths without `file://` protocol.
**Fix**: In `VideoMaskCanvas.tsx`, convert the path to a `file:///` URL before passing to `<video src>`.

### Issue 2: Step 1 uses mock data instead of real Whisper STT
**Root Cause**: `handleExtractAndTranslate()` in `ReupScreen.tsx` uses hardcoded mock segments instead of calling Whisper.
**Fix**: 
1. Add new IPC handler `extract-video-speech` in `electron/main.js` that: extracts audio from video via FFmpeg → runs `runWhisperLogic()` → returns word-level segments.
2. Add preload binding `extractVideoSpeech` and type declaration.
3. Update `ReupScreen.tsx` to call `extractVideoSpeech(videoPath)` then feed real segments to `translateSegments()`.

### Issue 3: FFmpeg exit code 4294967274
**Root Cause**: `buildReupFFmpegArgs()` in `reupRenderer.js` has a broken filtergraph:
- The blur filter uses `;` (stream label separator) inside a comma-joined filter chain, creating invalid syntax.
- When no voiceover/BGM audio inputs exist, no audio stream is mapped, causing FFmpeg to fail.
**Fix**: Rewrite `buildReupFFmpegArgs()`:
- Separate blur into its own proper filter chain with correct stream labeling.
- Always map the original audio stream (`0:a`) when no voiceover is provided.
- Build the complete `-filter_complex` string correctly.

### Issue 4: One-click auto-complete flow
**Fix**: Add a button "Tự Động Hoàn Tất" that runs the full pipeline sequentially: extract speech → translate → render. Show progress status during each phase.

### Issue 5: Missing output subtitle position control
**Fix**: The state `subtitlePos` already exists but is not passed to the render call or used in the filtergraph. Wire it through `renderReupVideo` params and use it in `buildReupFFmpegArgs()` to set ASS `MarginV` when burning subtitles. For now, expose the position selector UI and pass it to the render params for future subtitle burning support.

### Issue 6: API Key not persisted
**Fix**: Use `localStorage` to save/restore `apiKey`, `endpointUrl`, and `provider` in `ReupScreen.tsx`. Auto-load on mount, auto-save on change.

---

## 3. Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/components/VideoMaskCanvas.tsx` | MODIFY | Convert path to file:// URL for video src |
| `electron/main.js` | MODIFY | Add `extract-video-speech` IPC handler |
| `electron/preload.cjs` | MODIFY | Add `extractVideoSpeech` binding |
| `src/electron.d.ts` | MODIFY | Add type for `extractVideoSpeech` |
| `electron/reupRenderer.js` | MODIFY | Fix filtergraph, add subtitle position support |
| `src/components/ReupScreen.tsx` | MODIFY | Real Whisper integration, auto-complete flow, API key persistence, subtitle position UI |

---

## 4. Verification Plan

### Automated Tests
- `npm test` — all 46 tests pass
- `npm run build` — production build succeeds

### Manual Verification
1. Select video → verify video preview displays in canvas
2. Click Step 1 → verify real speech segments extracted from video
3. Click Render → verify FFmpeg completes without errors
4. Verify API key persists after page reload
