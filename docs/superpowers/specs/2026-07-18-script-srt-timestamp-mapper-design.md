# Script - SRT Timestamp Mapper Design Spec

## Goal
Provide a tool in the Aligner Screen that maps paragraphs or line segments of a user-provided script to their exact start timestamps from a word-level SRT file, outputting formatted timestamp text with optional millisecond precision.

## Proposed Changes

### 1. Backend Utility (`shared/timestampConverter.js`)
Add `mapScriptToSrtTimestamps(scriptText, srtContent, options = {})` helper function:
- `options.includeMs`: boolean (default: `false`). If `false`, outputs `[mm:ss]` rounding up $+1\text{s}$ when $\text{ms} \ge 500$. If `true`, outputs `[mm:ss:fff]`.
- Parses word-level SRT blocks into word array `[{ word, cleanWord, startMs }]`.
- Splits `scriptText` into non-empty paragraphs/lines.
- Uses sequential pointer matching to find the start timestamp of each script segment in the word-level SRT stream.
- Returns formatted timestamp text string.

### 2. IPC & Main Process (`electron/main.js`)
Add IPC handler `map-script-to-srt`:
- Accepts `{ scriptText, srtPath, srtContent, includeMs }`.
- Reads `srtPath` if `srtContent` is not provided directly.
- Returns `{ success: true, formattedText }`.

### 3. UI (`src/components/AlignerScreen.tsx` & `src/electron.d.ts`)
- Add sub-tabs at top of AlignerScreen: `Căn lề Phụ đề (Audio)` vs `Mapping Script (từ SRT)`.
- UI controls:
  - Script Input Textarea + Import `.txt` button.
  - SRT File Upload button + file name display.
  - Format toggle: `Không có ms [00:00]` vs `Có ms [00:00:000]`.
  - Process Button: **Mapping Timestamp**.
  - Output Textarea + **Copy** & **Save .txt** buttons.
- Add `mapScriptToSrt` signature to `src/electron.d.ts` and IPC bridge in `electron/preload.cjs`.

## Verification Plan
- Create unit tests in `tests/timestampConverter.test.js` to verify mapping accuracy, rounding rules ($\ge 500\text{ms} \rightarrow +1\text{s}$), and millisecond formatting (`[00:02:234]`).
- Run `npm test` to ensure zero regressions.
- Run `npm run build` to verify UI and TypeScript compilation.
