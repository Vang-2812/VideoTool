# Design Specification: Reup Module – TTS Voiceover & Render Progress Integration

## 1. Overview
Integrate AI Text-to-Speech (TTS) dubbing and a real-time rendering progress bar into the Reup Video module. This enables users to generate translation voiceovers, align them automatically using FFmpeg, and monitor render completion status with a visual progress bar.

---

## 2. Feature Architecture

### A. TTS Voiceover Generation & Mixing
1. **TTS Dropdown UI**: Add a checkbox "Lồng tiếng AI (TTS)" and a dropdown selector populated with available speaker voices matching the selected target (Reup) language.
2. **Audio Synthesis**: Group translated segments and send them to a new IPC handler `reup-generate-voiceover`. The handler runs the Chirp TTS engine for each segment sequentially, saving them as temporary audio files.
3. **FFmpeg Alignment**: Instead of stitching audio in Node.js, pass the generated voiceover segments `{ path, start }` to `buildReupFFmpegArgs`. The filtergraph will delay each segment stream using the `adelay` filter (e.g. `[i:a]adelay=delay_ms|delay_ms[a_i]`) and mix them using the `amix` filter.
4. **Cleanup**: Automatically delete temporary segment audio files after the FFmpeg render process finishes.

### B. Render Progress Bar
1. **Video Duration Extraction**: Before spawning FFmpeg, the main process calls `getVideoDuration` to obtain the input video's total duration.
2. **FFmpeg Output Parsing**: Monitor FFmpeg stderr during render, parse `time=HH:MM:SS.ms` outputs, calculate the progress percentage relative to total video duration, and estimate the remaining time (ETA).
3. **IPC Event Emission**: Send progress updates via `reup-render-progress` event to the frontend.
4. **UI Progress Bar**: Display a smooth, animated progress bar on the Reup tab showing the current percentage and ETA.

---

## 3. Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `electron/reupRenderer.js` | MODIFY | Support multiple voiceover segments in FFmpeg filtergraph using `adelay` and `amix` |
| `electron/main.js` | MODIFY | Add `reup-generate-voiceover` IPC handler, parse FFmpeg progress and emit `reup-render-progress` |
| `electron/preload.cjs` | MODIFY | Expose `generateReupVoiceover` and `onReupRenderProgress` |
| `src/electron.d.ts` | MODIFY | Add type definitions for new methods |
| `src/components/ReupScreen.tsx` | MODIFY | Add TTS configuration controls, render progress state & progress bar component |

---

## 4. Verification Plan

### Automated Tests
- `npm test` — all tests pass
- `npm run build` — client bundle builds successfully

### Manual Verification
1. Open Reup tab, upload a video and extract speech.
2. Enable "Lồng tiếng AI (TTS)", select a voice, and click Render.
3. Verify TTS audios are successfully generated.
4. Verify the progress bar animates smoothly showing progress (0-100%) and ETA.
5. Verify the output video has both visual filters and the generated voiceover.
