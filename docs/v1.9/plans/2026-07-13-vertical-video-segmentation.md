# Vertical Video Segmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional timestamp-based splitting to standalone and single-project vertical export, including configurable overlap, numbered titles/files, rebased subtitles, aggregate progress, cancellation, and project persistence.

**Architecture:** Keep `convertToVertical()` as the one-segment FFmpeg primitive and add a sequential batch orchestrator around it. Put timestamp parsing and segment planning in a pure shared ESM module consumed by React, Electron, and Node tests; isolate subtitle slicing/ASS generation in a backend module. Preserve the existing single-file path when split mode is disabled.

**Tech Stack:** Electron 41, Node.js ESM, React 19, TypeScript 6, Vite 7, FFmpeg/ffprobe from `ffmpeg-static`, Node built-in `node:test`.

## Global Constraints

- Scope includes standalone vertical conversion and single-project vertical export only; multi-project batch export is unchanged.
- Split mode defaults to disabled and requires at least one valid marker when enabled.
- Marker inputs accept `MM:SS` and `HH:MM:SS`; markers must be unique, greater than zero, and less than source duration.
- Overlap is an integer from 0 through 30 seconds and defaults to 5 seconds.
- Split outputs render sequentially from the horizontal source and use AAC audio for accurate cuts.
- Output names are `<base>_vertical_1.mp4`, `<base>_vertical_2.mp4`, and so on.
- Non-empty titles become `Title (1)`, `Title (2)`, and so on; an empty title remains absent.
- SRT cues are intersected with each segment, clamped to its boundaries, and rebased to zero.
- Completed segments survive cancellation or a later segment failure; the in-progress partial output is deleted.
- Existing `.sbvproj` files default to `vertical_split_enabled=false`, `vertical_split_points=[]`, and `vertical_overlap_seconds=5`.
- No third-party test dependency is added.
- Git metadata is invalid in the current workspace. Run each listed commit only if `git rev-parse --is-inside-work-tree` succeeds; otherwise record the commit step as skipped without initializing or repairing Git.

## File Structure

- Create `shared/verticalSegments.js`: pure timestamp parsing, validation, segment construction, display formatting, title naming, and filename naming.
- Create `shared/verticalSegments.d.ts`: exact TypeScript declarations for the shared ESM module.
- Create `tests/verticalSegments.test.js`: unit coverage for marker parsing, validation, overlap, titles, and filenames.
- Create `electron/verticalSubtitles.js`: parse SRT, slice/rebase cues, and create styled ASS files.
- Create `tests/verticalSubtitles.test.js`: unit coverage for boundary intersection, clamp, rebase, and renumbering.
- Create `electron/verticalBatchConverter.js`: sequential orchestration, weighted progress, cancellation, cleanup, and result aggregation.
- Create `tests/verticalBatchConverter.test.js`: orchestration tests with injected probe/render/remove dependencies.
- Create `src/components/VerticalSplitSettings.tsx`: reusable marker editor, overlap input, validation feedback, and segment preview.
- Modify `electron/verticalConverter.js`: export media duration probing and add one-segment start/duration support.
- Modify `electron/main.js`: expose duration probing, route standalone/project split requests to the batch orchestrator, and cancel the correct process.
- Modify `electron/preload.cjs`: expose `getVideoDuration`; reuse `selectExportDirectory`.
- Modify `src/electron.d.ts`: add split config, progress/result fields, project persistence fields, and duration API types.
- Modify `src/context/ProjectContext.tsx`: hold, reset, save, load, and submit split configuration.
- Modify `src/components/VerticalConvertScreen.tsx`: integrate standalone split UI, duration loading, output-directory selection, progress, and results.
- Modify `src/components/SettingsScreen.tsx`: integrate project split UI and block invalid export.
- Modify `src/components/RenderScreen.tsx`: show current vertical segment during project export.
- Modify `src/components/CompleteScreen.tsx`: show the vertical output list/count when present.
- Modify `package.json`: add Node test script and package `shared/**/*`.
- Modify `functional_specification.md` and `system_architecture.md`: document the new user flow, schema, and batch converter.

---

### Task 1: Shared timestamp and segment planner

**Files:**
- Create: `shared/verticalSegments.js`
- Create: `shared/verticalSegments.d.ts`
- Create: `tests/verticalSegments.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: raw marker strings, source duration in seconds, overlap seconds, base title, source/output basename.
- Produces: `parseTimestamp(value)`, `formatTimestamp(seconds)`, `validateSplitPointInputs(inputs, duration)`, `buildVerticalSegments(duration, splitPoints, overlapSeconds)`, `buildSegmentTitle(title, index)`, `buildSegmentFilename(baseName, index)`, and `normalizeProjectSplitConfig(project)`.

- [ ] **Step 1: Add a failing unit test suite**

```js
// tests/verticalSegments.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestamp,
  validateSplitPointInputs,
  buildVerticalSegments,
  buildSegmentTitle,
  buildSegmentFilename,
  normalizeProjectSplitConfig
} from '../shared/verticalSegments.js';

test('parses MM:SS and HH:MM:SS', () => {
  assert.deepEqual(parseTimestamp('02:00'), { ok: true, seconds: 120 });
  assert.deepEqual(parseTimestamp('01:02:03'), { ok: true, seconds: 3723 });
  assert.equal(parseTimestamp('02:60').ok, false);
});

test('validates, sorts, and rejects duplicate markers', () => {
  assert.deepEqual(validateSplitPointInputs(['03:00', '02:00'], 300), {
    valid: true,
    splitPoints: [120, 180],
    errors: [null, null]
  });
  assert.equal(validateSplitPointInputs(['02:00', '02:00'], 300).valid, false);
});

test('builds overlapping segments', () => {
  assert.deepEqual(buildVerticalSegments(300, [120, 180], 5), [
    { index: 1, startTime: 0, endTime: 120, duration: 120 },
    { index: 2, startTime: 115, endTime: 180, duration: 65 },
    { index: 3, startTime: 175, endTime: 300, duration: 125 }
  ]);
  assert.equal(buildVerticalSegments(20, [3], 5)[1].startTime, 0);
});

test('numbers titles and files', () => {
  assert.equal(buildSegmentTitle('Title', 2), 'Title (2)');
  assert.equal(buildSegmentTitle('', 2), '');
  assert.equal(buildSegmentFilename('video.mp4', 2), 'video_vertical_2.mp4');
});

test('normalizes old project split defaults', () => {
  assert.deepEqual(normalizeProjectSplitConfig({}), {
    enabled: false,
    splitPoints: [],
    overlapSeconds: 5
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --test tests/verticalSegments.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `shared/verticalSegments.js`.

- [ ] **Step 3: Implement the pure shared module and declarations**

```js
// shared/verticalSegments.js
export function parseTimestamp(value) {
  const parts = String(value).trim().split(':');
  if (parts.length !== 2 && parts.length !== 3) return { ok: false, error: 'Dùng định dạng MM:SS hoặc HH:MM:SS.' };
  if (parts.some((part) => !/^\d+$/.test(part))) return { ok: false, error: 'Mốc thời gian chỉ được chứa chữ số và dấu hai chấm.' };
  const nums = parts.map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) return { ok: false, error: 'Phút hoặc giây nằm ngoài phạm vi 00–59.' };
  return { ok: true, seconds: hours * 3600 + minutes * 60 + seconds };
}

export function formatTimestamp(value) {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function validateSplitPointInputs(inputs, duration) {
  const parsed = inputs.map(parseTimestamp);
  const counts = new Map();
  for (const result of parsed) if (result.ok) counts.set(result.seconds, (counts.get(result.seconds) || 0) + 1);
  const errors = parsed.map((result) => {
    if (!result.ok) return result.error;
    if (result.seconds <= 0) return 'Mốc phải lớn hơn 00:00.';
    if (!Number.isFinite(duration) || duration <= 0) return 'Chưa đọc được thời lượng video.';
    if (result.seconds >= duration) return 'Mốc phải nhỏ hơn thời lượng video.';
    if (counts.get(result.seconds) > 1) return 'Mốc thời gian bị trùng.';
    return null;
  });
  return {
    valid: inputs.length > 0 && errors.every((error) => error === null),
    splitPoints: parsed.filter((result, index) => result.ok && errors[index] === null).map((result) => result.seconds).sort((a, b) => a - b),
    errors
  };
}

export function buildVerticalSegments(duration, splitPoints, overlapSeconds) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Thời lượng video không hợp lệ.');
  if (!Number.isInteger(overlapSeconds) || overlapSeconds < 0 || overlapSeconds > 30) throw new Error('Overlap phải là số nguyên từ 0 đến 30.');
  const points = [...splitPoints].sort((a, b) => a - b);
  if (points.length === 0 || points.some((point, index) => point <= 0 || point >= duration || (index > 0 && point === points[index - 1]))) {
    throw new Error('Danh sách mốc chia không hợp lệ.');
  }
  const ends = [...points, duration];
  return ends.map((endTime, index) => {
    const startTime = index === 0 ? 0 : Math.max(0, points[index - 1] - overlapSeconds);
    if (endTime <= startTime) throw new Error(`Đoạn ${index + 1} không có thời lượng dương.`);
    return { index: index + 1, startTime, endTime, duration: endTime - startTime };
  });
}

export function buildSegmentTitle(title, index) {
  const trimmed = String(title || '').trim();
  return trimmed ? `${trimmed} (${index})` : '';
}

export function buildSegmentFilename(baseName, index) {
  const fileName = String(baseName || 'video.mp4').split(/[\\/]/).pop() || 'video.mp4';
  const stem = fileName.replace(/\.[^.]+$/, '').replace(/_vertical$/i, '');
  return `${stem}_vertical_${index}.mp4`;
}

export function normalizeProjectSplitConfig(project) {
  return {
    enabled: project.vertical_split_enabled ?? false,
    splitPoints: project.vertical_split_points ?? [],
    overlapSeconds: project.vertical_overlap_seconds ?? 5
  };
}
```

```ts
// shared/verticalSegments.d.ts
export interface VerticalSegment { index: number; startTime: number; endTime: number; duration: number }
export type TimestampResult = { ok: true; seconds: number } | { ok: false; error: string };
export function parseTimestamp(value: string): TimestampResult;
export function formatTimestamp(seconds: number): string;
export function validateSplitPointInputs(inputs: string[], duration: number): { valid: boolean; splitPoints: number[]; errors: Array<string | null> };
export function buildVerticalSegments(duration: number, splitPoints: number[], overlapSeconds: number): VerticalSegment[];
export function buildSegmentTitle(title: string, index: number): string;
export function buildSegmentFilename(baseName: string, index: number): string;
export function normalizeProjectSplitConfig(project: { vertical_split_enabled?: boolean; vertical_split_points?: number[]; vertical_overlap_seconds?: number }): { enabled: boolean; splitPoints: number[]; overlapSeconds: number };
```

Add `"test": "node --test tests/*.test.js"` to `scripts` and `"shared/**/*"` to `build.files` in `package.json`.

- [ ] **Step 4: Run planner tests and the production build**

Run: `npm test`

Expected: all five planner tests PASS.

Run: `npm run build`

Expected: TypeScript and Vite build complete with exit code 0.

- [ ] **Step 5: Commit the planner deliverable when Git is available**

```bash
git add package.json shared/verticalSegments.js shared/verticalSegments.d.ts tests/verticalSegments.test.js
git commit -m "feat: add vertical segment planner"
```

### Task 2: Segment-aware SRT and ASS generation

**Files:**
- Create: `electron/verticalSubtitles.js`
- Create: `tests/verticalSubtitles.test.js`
- Modify: `electron/verticalConverter.js:133-192`

**Interfaces:**
- Consumes: SRT text or path, optional `{ startTime, endTime }`, and existing subtitle style values.
- Produces: `parseSrtCues(content)`, `sliceAndRebaseCues(cues, startTime, endTime)`, and `convertSrtToAss(options)`.

- [ ] **Step 1: Write failing boundary/rebase tests**

```js
// tests/verticalSubtitles.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSrtCues, sliceAndRebaseCues } from '../electron/verticalSubtitles.js';

const content = `1\n00:01:50,000 --> 00:01:58,000\nBefore and overlap\n\n2\n00:01:59,000 --> 00:02:05,000\nAcross boundary\n\n3\n00:03:01,000 --> 00:03:02,000\nAfter`;

test('keeps intersecting cues and rebases them to segment zero', () => {
  const cues = sliceAndRebaseCues(parseSrtCues(content), 115, 180);
  assert.deepEqual(cues, [
    { start: 0, end: 3, text: 'Before and overlap' },
    { start: 4, end: 10, text: 'Across boundary' }
  ]);
});
```

- [ ] **Step 2: Verify the subtitle module test fails**

Run: `node --test tests/verticalSubtitles.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Extract subtitle responsibilities into the new module**

Implement parsing and slicing exactly as follows, then move the existing ASS header/style formatting from `verticalConverter.js` into `convertSrtToAss` without changing the current font, colors, alignment, margins, or escaping behavior:

```js
// electron/verticalSubtitles.js
import fs from 'node:fs/promises';

function parseSrtTime(value) {
  const [hours, minutes, rest] = value.replace(',', '.').split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
}

export function parseSrtCues(content) {
  return content.split(/\r?\n\r?\n/).filter(Boolean).flatMap((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) return [];
    const [start, end] = lines[timeIndex].split('-->').map((value) => parseSrtTime(value.trim()));
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? [{ start, end, text: lines.slice(timeIndex + 1).join('\\N') }]
      : [];
  });
}

export function sliceAndRebaseCues(cues, startTime, endTime) {
  return cues
    .filter((cue) => cue.end > startTime && cue.start < endTime)
    .map((cue) => ({
      start: Math.max(cue.start, startTime) - startTime,
      end: Math.min(cue.end, endTime) - startTime,
      text: cue.text
    }))
    .filter((cue) => cue.end > cue.start);
}

function hexToAssColor(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '&H00FFFFFF';
  return `&H00${full.slice(4, 6)}${full.slice(2, 4)}${full.slice(0, 2)}`;
}

function formatAssTime(value) {
  const centiseconds = Math.max(0, Math.round(value * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const fraction = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
}

function buildAssDocument(cues, subtitleFontSize, subtitleColor, subtitleMarginV) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${subtitleFontSize},${hexToAssColor(subtitleColor)},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,80,80,${subtitleMarginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = cues.map((cue) =>
    `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${cue.text}`
  );
  return header + events.join('\n');
}

export async function convertSrtToAss({ srtPath, assPath, subtitleFontSize = 54, subtitleColor = '#FFFF00', subtitleMarginV = 180, startTime, endTime }) {
  const content = await fs.readFile(srtPath, 'utf8');
  const parsed = parseSrtCues(content);
  const cues = Number.isFinite(startTime) && Number.isFinite(endTime)
    ? sliceAndRebaseCues(parsed, startTime, endTime)
    : parsed;
  await fs.writeFile(assPath, buildAssDocument(cues, subtitleFontSize, subtitleColor, subtitleMarginV), 'utf8');
}
```

In `verticalConverter.js`, import `convertSrtToAss` from `./verticalSubtitles.js` and delete the old embedded SRT parser/ASS writer.

- [ ] **Step 4: Run subtitle and planner tests**

Run: `npm test`

Expected: planner and subtitle tests PASS.

- [ ] **Step 5: Commit the subtitle deliverable when Git is available**

```bash
git add electron/verticalSubtitles.js electron/verticalConverter.js tests/verticalSubtitles.test.js
git commit -m "feat: slice vertical subtitles by segment"
```

### Task 3: FFmpeg segment primitive and sequential batch orchestrator

**Files:**
- Create: `electron/verticalBatchConverter.js`
- Create: `tests/verticalBatchConverter.test.js`
- Modify: `electron/verticalConverter.js:43-59,198-399`

**Interfaces:**
- Consumes: existing vertical render params plus `splitConfig`, output directory/base name, and progress callback.
- Produces: exported `getVideoDuration(filePath)`, segment-aware `convertToVertical(params, onProgress)`, `convertToVerticalBatch(params, onProgress, dependencies?)`, and `cancelVerticalBatch()`.

- [ ] **Step 1: Write a failing orchestrator test with injected dependencies**

```js
// tests/verticalBatchConverter.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToVerticalBatch } from '../electron/verticalBatchConverter.js';

test('renders segments sequentially with numbered titles and weighted progress', async () => {
  const calls = [];
  const progress = [];
  const result = await convertToVerticalBatch({
    sourceVideoPath: 'C:/media/video.mp4',
    outputDirectory: 'C:/out',
    outputBaseName: 'video.mp4',
    title: 'Title',
    splitPoints: [120, 180],
    overlapSeconds: 5
  }, (event) => progress.push(event), {
    probeDuration: async () => 300,
    renderSegment: async (params, onSegmentProgress) => {
      calls.push(params);
      onSegmentProgress({ progress: 100, eta: '00:00' });
      return { success: true };
    },
    removeFile: async () => {}
  });
  assert.equal(result.success, true);
  assert.deepEqual(calls.map((call) => [call.startTime, call.duration, call.title]), [
    [0, 120, 'Title (1)'], [115, 65, 'Title (2)'], [175, 125, 'Title (3)']
  ]);
  assert.equal(result.outputPaths.at(-1), 'C:\\out\\video_vertical_3.mp4');
  assert.deepEqual(progress.slice(0, 3).map((event) => event.progress), [38, 59, 100]);
  assert.equal(progress.at(-1).progress, 100);
});
```

- [ ] **Step 2: Run the orchestrator test and verify it fails**

Run: `node --test tests/verticalBatchConverter.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Extend the one-segment FFmpeg primitive**

Export `getVideoDuration`. Extend params with `startTime` and `duration`. Build the input portion and audio codec as follows:

```js
const isSegment = Number.isFinite(startTime) && Number.isFinite(duration);
const args = ['-y'];
if (isSegment) args.push('-ss', String(startTime));
args.push('-i', finalInputPath);
if (isSegment) args.push('-t', String(duration));
args.push(
  '-filter_complex', filterGraph,
  '-map', lastLabel,
  '-map', '0:a?',
  '-c:v', 'libx264',
  '-b:v', bitrate,
  '-pix_fmt', 'yuv420p',
  '-c:a', isSegment ? 'aac' : 'copy',
  ...(isSegment ? ['-b:a', '192k'] : []),
  outputPath
);
```

For subtitles, pass `startTime` and `startTime + duration` into `convertSrtToAss`. Use the segment duration, rather than full source duration, as the denominator for FFmpeg progress.

Replace the existing subtitle catch with fail-fast behavior for split segments while preserving the legacy skip behavior for a full conversion:

```js
} catch (error) {
  if (isSegment) throw new Error(`Không thể xử lý phụ đề cho đoạn video: ${error.message}`);
  console.error('Subtitle file not accessible, skipping burn:', error);
}
```

- [ ] **Step 4: Implement the batch orchestrator**

```js
// electron/verticalBatchConverter.js
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildVerticalSegments, buildSegmentFilename, buildSegmentTitle } from '../shared/verticalSegments.js';
import { convertToVertical, cancelVerticalConvert, getVideoDuration } from './verticalConverter.js';

let batchCancelled = false;

export async function convertToVerticalBatch(params, onProgress, dependencies = {}) {
  const probeDuration = dependencies.probeDuration || getVideoDuration;
  const renderSegment = dependencies.renderSegment || convertToVertical;
  const removeFile = dependencies.removeFile || ((filePath) => fs.unlink(filePath).catch(() => {}));
  batchCancelled = false;
  const sourceDuration = await probeDuration(params.sourceVideoPath || params.inputPath);
  const segments = buildVerticalSegments(sourceDuration, params.splitPoints, params.overlapSeconds);
  const totalWork = segments.reduce((sum, segment) => sum + segment.duration, 0);
  const outputPaths = [];
  let completedWork = 0;

  for (const segment of segments) {
    if (batchCancelled) return { success: false, cancelled: true, outputPaths, completedSegments: outputPaths.length, totalSegments: segments.length, error: 'Đã hủy chuyển đổi.' };
    const outputPath = path.join(params.outputDirectory, buildSegmentFilename(params.outputBaseName, segment.index));
    const result = await renderSegment({
      ...params,
      outputPath,
      title: buildSegmentTitle(params.title, segment.index),
      startTime: segment.startTime,
      duration: segment.duration,
      splitPoints: undefined,
      overlapSeconds: undefined,
      outputDirectory: undefined,
      outputBaseName: undefined
    }, (current) => onProgress?.({
      ...current,
      progress: Math.min(100, Math.floor(((completedWork + segment.duration * current.progress / 100) / totalWork) * 100)),
      segmentIndex: segment.index,
      segmentCount: segments.length
    }));
    if (batchCancelled) {
      await removeFile(outputPath);
      return { success: false, cancelled: true, outputPaths, completedSegments: outputPaths.length, totalSegments: segments.length, error: 'Đã hủy chuyển đổi.' };
    }
    if (!result.success) {
      await removeFile(outputPath);
      return { success: false, outputPaths, completedSegments: outputPaths.length, totalSegments: segments.length, error: `Đoạn ${segment.index}/${segments.length}: ${result.error || 'FFmpeg thất bại.'}` };
    }
    outputPaths.push(outputPath);
    completedWork += segment.duration;
  }
  onProgress?.({ progress: 100, eta: '00:00', segmentIndex: segments.length, segmentCount: segments.length });
  return { success: true, outputPaths, completedSegments: segments.length, totalSegments: segments.length };
}

export function cancelVerticalBatch() {
  batchCancelled = true;
  return cancelVerticalConvert();
}
```

- [ ] **Step 5: Run backend tests and syntax checks**

Run: `npm test`

Expected: all suites PASS.

Run: `node --check electron/verticalConverter.js`

Expected: no output and exit code 0.

Run: `node --check electron/verticalBatchConverter.js`

Expected: no output and exit code 0.

- [ ] **Step 6: Commit the backend deliverable when Git is available**

```bash
git add electron/verticalConverter.js electron/verticalBatchConverter.js tests/verticalBatchConverter.test.js
git commit -m "feat: render vertical segments sequentially"
```

### Task 4: IPC, cancellation, and renderer type contract

**Files:**
- Modify: `electron/main.js:14,170-222,1326-1339`
- Modify: `electron/preload.cjs:1-40`
- Modify: `src/electron.d.ts:29-74,107-180,209`

**Interfaces:**
- Consumes: batch functions from Task 3 and existing `selectExportDirectory`.
- Produces: `getVideoDuration(filePath)`, typed `VerticalSplitConfig`, typed batch results/progress, and project `verticalVideoPaths`.

- [ ] **Step 1: Add the renderer type contract before wiring runtime code**

```ts
interface VerticalSplitConfig {
  enabled: boolean;
  splitPoints: number[];
  overlapSeconds: number;
  outputDirectory?: string;
  outputBaseName?: string;
}

interface VerticalProgress {
  progress: number;
  eta: string;
  segmentIndex?: number;
  segmentCount?: number;
}

interface VerticalConvertResult {
  success: boolean;
  outputPaths?: string[];
  completedSegments?: number;
  totalSegments?: number;
  cancelled?: boolean;
  error?: string;
}
```

Add `verticalSplitConfig?: VerticalSplitConfig` to `RenderSettings`, `verticalVideoPaths?: string[]` and `verticalError?: string` to `RenderResult`, split persistence fields to `ProjectData`, `getVideoDuration` to `ElectronAPI`, and update `convertToVertical`/`onVerticalConvertProgress` to use the new types.

- [ ] **Step 2: Expose duration probing and batch cancellation**

Update the imports in `electron/main.js`:

```js
import { convertToVertical, getVideoDuration } from './verticalConverter.js';
import { convertToVerticalBatch, cancelVerticalBatch } from './verticalBatchConverter.js';
```

```js
// electron/preload.cjs
getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
```

```js
// electron/main.js
ipcMain.handle('get-video-duration', async (_, filePath) => {
  try {
    return { success: true, duration: await getVideoDuration(filePath) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-render', async () => {
  cancelActiveRender();
  cancelVerticalBatch();
});

ipcMain.handle('cancel-vertical-convert', async () => cancelVerticalBatch());
```

- [ ] **Step 3: Route standalone and project split requests**

Replace the standalone handler with:

```js
ipcMain.handle('convert-to-vertical', async (event, params) => {
  try {
    const reportProgress = (progressData) => event.sender.send('vertical-convert-progress', progressData);
    if (params.splitConfig?.enabled) {
      return await convertToVerticalBatch({
        ...params,
        outputDirectory: params.splitConfig.outputDirectory,
        outputBaseName: params.splitConfig.outputBaseName,
        splitPoints: params.splitConfig.splitPoints,
        overlapSeconds: params.splitConfig.overlapSeconds
      }, reportProgress);
    }
    return await convertToVertical(params, reportProgress);
  } catch (error) {
    return { success: false, outputPaths: [], error: error.message };
  }
});
```

For the single-project `render-video` handler, after horizontal success:

```js
const vertPath = settings.outputPath.replace(/\.mp4$/i, '_vertical.mp4');
const verticalParams = {
  inputPath: settings.outputPath,
  outputPath: vertPath,
  title: settings.videoTitle,
  srtPath: settings.verticalSrtPath,
  qualityPreset: settings.preset,
  titleFontSize: settings.verticalTitleFontSize,
  subtitleFontSize: settings.verticalSubtitleFontSize,
  titleColor: settings.verticalTitleColor,
  subtitleColor: settings.verticalSubtitleColor,
  titleYPercent: settings.verticalTitleYPercent,
  subtitleMarginV: settings.verticalSubtitleMarginV
};
const mapVerticalProgressToOverallRender = (progressData) => {
  event.sender.send('render-progress', {
    progress: 95 + progressData.progress * 0.05,
    eta: `Đang xuất bản dọc... (${progressData.progress}%)`,
    segmentIndex: progressData.segmentIndex,
    segmentCount: progressData.segmentCount
  });
};
const splitConfig = settings.verticalSplitConfig;
if (splitConfig?.enabled) {
  const batchResult = await convertToVerticalBatch({
    ...verticalParams,
    sourceVideoPath: settings.outputPath,
    outputDirectory: path.dirname(settings.outputPath),
    outputBaseName: path.basename(settings.outputPath),
    splitPoints: splitConfig.splitPoints,
    overlapSeconds: splitConfig.overlapSeconds
  }, mapVerticalProgressToOverallRender);
  result.verticalVideoPaths = batchResult.outputPaths;
  if (!batchResult.success) result.verticalError = batchResult.error;
} else {
  const singleResult = await convertToVertical(verticalParams, mapVerticalProgressToOverallRender);
  if (singleResult.success) result.verticalVideoPaths = [vertPath];
  else result.verticalError = singleResult.error;
}
```

Do not change the `start-batch-render` project loop at `electron/main.js:539-559`.

- [ ] **Step 4: Run contract build and backend syntax checks**

Run: `npm run build`

Expected: TypeScript/Vite build exits 0.

Run: `node --check electron/main.js`

Expected: no output and exit code 0.

- [ ] **Step 5: Commit the IPC deliverable when Git is available**

```bash
git add electron/main.js electron/preload.cjs src/electron.d.ts
git commit -m "feat: expose vertical split IPC contract"
```

### Task 5: Project split state and `.sbvproj` persistence

**Files:**
- Modify: `src/context/ProjectContext.tsx:93-111,215-224,364-443,610-726,932-1020`
- Modify: `src/electron.d.ts:107-120`

**Interfaces:**
- Consumes: `VerticalSplitConfig` from Task 4.
- Produces: context state/actions `verticalSplitEnabled`, `verticalSplitPoints`, `verticalOverlapSeconds` and a render request containing `verticalSplitConfig`.

- [ ] **Step 1: Add state and actions to `ProjectContextType`**

```ts
verticalSplitEnabled: boolean;
verticalSplitPoints: number[];
verticalOverlapSeconds: number;
setVerticalSplitEnabled: (enabled: boolean) => void;
setVerticalSplitPoints: (points: number[]) => void;
setVerticalOverlapSeconds: (seconds: number) => void;
```

- [ ] **Step 2: Initialize, submit, reset, and expose the state**

```ts
const [verticalSplitEnabled, setVerticalSplitEnabled] = useState(false);
const [verticalSplitPoints, setVerticalSplitPoints] = useState<number[]>([]);
const [verticalOverlapSeconds, setVerticalOverlapSeconds] = useState(5);
```

Add to `RenderSettings` in `startRender`:

```ts
verticalSplitConfig: {
  enabled: verticalSplitEnabled,
  splitPoints: verticalSplitPoints,
  overlapSeconds: verticalOverlapSeconds
}
```

Add to `resetProject`:

```ts
setVerticalSplitEnabled(false);
setVerticalSplitPoints([]);
setVerticalOverlapSeconds(5);
```

Expose all three values and setters in the provider value.

- [ ] **Step 3: Save and load backward-compatible project fields**

Add to both `saveProject` and `saveProjectAs` payloads:

```ts
vertical_split_enabled: verticalSplitEnabled,
vertical_split_points: verticalSplitPoints,
vertical_overlap_seconds: verticalOverlapSeconds
```

Add to `applyLoadedProject`:

```ts
const splitConfig = normalizeProjectSplitConfig(project);
setVerticalSplitEnabled(splitConfig.enabled);
setVerticalSplitPoints(splitConfig.splitPoints);
setVerticalOverlapSeconds(splitConfig.overlapSeconds);
```

Import `normalizeProjectSplitConfig` from `../../shared/verticalSegments.js` at the top of `ProjectContext.tsx`.

- [ ] **Step 4: Build to catch context/type omissions**

Run: `npm run build`

Expected: exit code 0 with no missing provider properties or excess `ProjectData` fields.

- [ ] **Step 5: Commit persistence when Git is available**

```bash
git add src/context/ProjectContext.tsx src/electron.d.ts
git commit -m "feat: persist vertical split settings"
```

### Task 6: Reusable split settings editor

**Files:**
- Create: `src/components/VerticalSplitSettings.tsx`

**Interfaces:**
- Consumes: `enabled`, marker strings, overlap, duration, base filename/title, and callbacks.
- Produces: inline field errors, preview segments, and `onValidationChange({ valid, splitPoints })`.

- [ ] **Step 1: Create the typed component contract and validation memo**

```tsx
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  buildSegmentFilename,
  buildSegmentTitle,
  buildVerticalSegments,
  formatTimestamp,
  validateSplitPointInputs
} from '../../shared/verticalSegments.js';

interface Props {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  markerInputs: string[];
  onMarkerInputsChange: (inputs: string[]) => void;
  overlapSeconds: number;
  onOverlapSecondsChange: (seconds: number) => void;
  duration: number | null;
  baseFilename: string;
  title: string;
  onValidationChange: (result: { valid: boolean; splitPoints: number[] }) => void;
}

export default function VerticalSplitSettings(props: Props) {
  const validation = React.useMemo(
    () => validateSplitPointInputs(props.markerInputs, props.duration ?? Number.NaN),
    [props.markerInputs, props.duration]
  );
  const overlapValid = Number.isInteger(props.overlapSeconds) && props.overlapSeconds >= 0 && props.overlapSeconds <= 30;
  const valid = !props.enabled || (validation.valid && overlapValid);
  const splitPointsKey = validation.splitPoints.join(',');
  React.useEffect(() => {
    props.onValidationChange({ valid, splitPoints: validation.splitPoints });
  }, [valid, splitPointsKey, props.onValidationChange]);
  const segments = props.enabled && valid && props.duration
    ? buildVerticalSegments(props.duration, validation.splitPoints, props.overlapSeconds)
    : [];
  return (
    <section className="space-y-3 rounded-xl border border-border-dark bg-bg-dark p-3">
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-300">
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(event) => props.onEnabledChange(event.target.checked)}
          className="accent-primary"
        />
        Tách thành nhiều video ngắn
      </label>
      {props.enabled && (
        <>
          <div className="space-y-2">
            {props.markerInputs.map((value, index) => (
              <div key={index} className="space-y-1">
                <div className="flex gap-2">
                  <input
                    value={value}
                    placeholder="MM:SS hoặc HH:MM:SS"
                    onChange={(event) => props.onMarkerInputsChange(
                      props.markerInputs.map((current, i) => i === index ? event.target.value : current)
                    )}
                    className="flex-1 rounded-lg border border-border-dark bg-bg-panel px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    aria-label={`Xóa mốc ${index + 1}`}
                    onClick={() => props.onMarkerInputsChange(props.markerInputs.filter((_, i) => i !== index))}
                    className="rounded-lg border border-red-500/30 px-2 text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {validation.errors[index] && <p className="text-[10px] text-red-400">{validation.errors[index]}</p>}
              </div>
            ))}
            <button
              type="button"
              onClick={() => props.onMarkerInputsChange([...props.markerInputs, ''])}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Plus className="h-4 w-4" /> Thêm mốc
            </button>
          </div>
          <label className="block text-xs text-gray-400">
            Chồng lấn (giây)
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={props.overlapSeconds}
              onChange={(event) => props.onOverlapSecondsChange(Number(event.target.value))}
              className="ml-2 w-20 rounded-lg border border-border-dark bg-bg-panel px-2 py-1 text-white"
            />
          </label>
          {!overlapValid && <p className="text-[10px] text-red-400">Overlap phải là số nguyên từ 0 đến 30.</p>}
          {segments.length > 0 && (
            <div className="space-y-1 rounded-lg border border-border-dark p-2 text-[10px] text-gray-400">
              {segments.map((segment) => (
                <div key={segment.index}>
                  <div>Đoạn {segment.index}: {formatTimestamp(segment.startTime)} → {formatTimestamp(segment.endTime)}</div>
                  <div>{buildSegmentTitle(props.title, segment.index) || '(không có title)'}</div>
                  <div className="font-mono">{buildSegmentFilename(props.baseFilename, segment.index)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
```

In each parent, wrap `onValidationChange` in `React.useCallback` so the component effect only reruns when validation content changes.

- [ ] **Step 2: Build the reusable UI component**

Run: `npm run build`

Expected: component compiles with no unused imports/props and Vite resolves `shared/verticalSegments.js`.

- [ ] **Step 3: Commit the component when Git is available**

```bash
git add src/components/VerticalSplitSettings.tsx
git commit -m "feat: add vertical split settings editor"
```

### Task 7: Integrate standalone and project UI flows

**Files:**
- Modify: `src/components/VerticalConvertScreen.tsx:15-137,139-445,507-end`
- Modify: `src/components/SettingsScreen.tsx:1-91,285-505,580-590`
- Modify: `src/components/RenderScreen.tsx`
- Modify: `src/components/CompleteScreen.tsx`

**Interfaces:**
- Consumes: shared editor from Task 6, context fields from Task 5, and IPC types from Task 4.
- Produces: validated standalone/project requests and visible multi-file results/progress.

- [ ] **Step 1: Integrate standalone state, duration, and output folder**

Add state:

```tsx
const [videoDuration, setVideoDuration] = useState<number | null>(null);
const [splitEnabled, setSplitEnabled] = useState(false);
const [markerInputs, setMarkerInputs] = useState<string[]>([]);
const [splitPoints, setSplitPoints] = useState<number[]>([]);
const [overlapSeconds, setOverlapSeconds] = useState(5);
const [splitValid, setSplitValid] = useState(true);
const [segmentIndex, setSegmentIndex] = useState<number | null>(null);
const [segmentCount, setSegmentCount] = useState<number | null>(null);
const [result, setResult] = useState<VerticalConvertResult | null>(null);
```

After video selection:

```tsx
const durationResult = await window.electronAPI.getVideoDuration(res.path);
setVideoDuration(durationResult.success ? durationResult.duration ?? null : null);
```

Before invoking conversion:

```tsx
const outputDirectory = splitEnabled
  ? await window.electronAPI.selectExportDirectory()
  : null;
const savePath = splitEnabled
  ? undefined
  : await window.electronAPI.selectSavePath(videoFile.path.replace(/\.mp4$/i, '_vertical.mp4'));
if ((splitEnabled && !outputDirectory) || (!splitEnabled && !savePath)) return;
```

Send the complete request:

```tsx
const response = await window.electronAPI.convertToVertical({
  sourceVideoPath: videoFile.path,
  outputPath: savePath ?? '',
  title: title.trim(),
  srtPath: srtFile?.path ?? '',
  qualityPreset: preset,
  titleFontSize,
  subtitleFontSize,
  titleColor,
  subtitleColor,
  titleYPercent,
  subtitleMarginV,
  splitConfig: {
    enabled: splitEnabled,
    splitPoints,
    overlapSeconds,
    outputDirectory: outputDirectory ?? undefined,
    outputBaseName: videoFile.name
  }
});
```

Normalize the response so the legacy single-file flow still has a result path:

```tsx
const normalizedResult: VerticalConvertResult = splitEnabled
  ? response
  : { ...response, outputPaths: response.success && savePath ? [savePath] : [] };
setResult(normalizedResult);
```

Disable convert when `!videoFile || (splitEnabled && !splitValid)`. Show `Đang tạo đoạn n/N` from progress and show the resulting file count plus the first output path; `Mở thư mục` uses `result.outputPaths?.[0]`.

Pass this stable callback to `VerticalSplitSettings`:

```tsx
const handleStandaloneSplitValidation = React.useCallback((validation: { valid: boolean; splitPoints: number[] }) => {
  setSplitValid(validation.valid);
  if (validation.valid) setSplitPoints(validation.splitPoints);
}, []);
```

- [ ] **Step 2: Integrate project settings with context persistence**

Read the three context values/setters. Keep marker display strings synchronized from stored seconds:

```tsx
const [verticalMarkerInputs, setVerticalMarkerInputs] = React.useState(
  verticalSplitPoints.map(formatTimestamp)
);
const [verticalSplitValid, setVerticalSplitValid] = React.useState(true);
```

Render `VerticalSplitSettings` inside the existing vertical panel after the SRT section. On valid changes, call `setVerticalSplitPoints(result.splitPoints)`. In `handleStartRender`, block when vertical export and split are enabled but validation is invalid.

Use a stable project validation callback:

```tsx
const handleProjectSplitValidation = React.useCallback((validation: { valid: boolean; splitPoints: number[] }) => {
  setVerticalSplitValid(validation.valid);
  if (validation.valid) setVerticalSplitPoints(validation.splitPoints);
}, [setVerticalSplitPoints]);
```

- [ ] **Step 3: Show project segment progress and output results**

Extend `RenderProgress` with `segmentIndex` and `segmentCount`, retain those fields in `ProjectContext`'s progress listener, and render:

```tsx
{renderProgress.segmentIndex && renderProgress.segmentCount && (
  <div className="text-[10px] text-primary font-mono">
    Đang tạo video dọc {renderProgress.segmentIndex}/{renderProgress.segmentCount}
  </div>
)}
```

In `CompleteScreen`, show a second result block when `renderResult.verticalVideoPaths?.length` is non-zero:

```tsx
<div className="pt-2 border-t border-border-dark/30">
  <span className="text-gray-500 block text-xs">Video dọc đã tạo</span>
  <span className="text-white font-semibold">{renderResult.verticalVideoPaths.length} file</span>
  {renderResult.verticalVideoPaths.map((filePath) => (
    <code key={filePath} className="text-[11px] text-accent font-mono block break-all">{filePath}</code>
  ))}
</div>
```

- [ ] **Step 4: Run full automated verification**

Run: `npm test`

Expected: all planner, subtitle, and batch tests PASS.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 5: Commit UI integration when Git is available**

```bash
git add src/components/VerticalConvertScreen.tsx src/components/SettingsScreen.tsx src/components/RenderScreen.tsx src/components/CompleteScreen.tsx src/context/ProjectContext.tsx src/electron.d.ts
git commit -m "feat: expose vertical video splitting in the UI"
```

### Task 8: Documentation and end-to-end regression verification

**Files:**
- Modify: `functional_specification.md`
- Modify: `system_architecture.md`
- Verify: all files changed in Tasks 1-7

**Interfaces:**
- Consumes: completed behavior from all earlier tasks.
- Produces: updated product/architecture documentation and a recorded verification result.

- [ ] **Step 1: Update the functional specification**

Add a subsection under vertical export documenting:

```markdown
### Tách video dọc thành nhiều video ngắn
- Áp dụng cho converter độc lập và xuất dọc trong một project.
- Người dùng nhập danh sách mốc MM:SS hoặc HH:MM:SS.
- Overlap cấu hình 0–30 giây, mặc định 5 giây.
- Các đoạn sau bắt đầu tại mốc trước trừ overlap và được clamp về 00:00.
- Title và tên file được đánh số từ 1.
- Phụ đề được cắt và đưa timestamp về 00:00 cho từng đoạn.
```

- [ ] **Step 2: Update the architecture and schema documentation**

Document `verticalBatchConverter.js`, sequential FFmpeg orchestration, the three `.sbvproj` fields, weighted progress, and the new `get-video-duration` IPC. Explicitly state multi-project batch export is unchanged.

- [ ] **Step 3: Run final automated checks**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: exit code 0.

Run: `node --check electron/main.js`

Expected: no output and exit code 0.

Run: `node --check electron/verticalConverter.js`

Expected: no output and exit code 0.

Run: `node --check electron/verticalBatchConverter.js`

Expected: no output and exit code 0.

- [ ] **Step 4: Perform manual media regression checks**

Use a five-minute MP4 and a valid SRT. Verify:

1. Split disabled still creates one `_vertical.mp4` with unchanged layout/audio.
2. Markers `02:00` and `03:00`, overlap `5`, create durations approximately `120`, `65`, and `125` seconds.
3. Titles end in `(1)`, `(2)`, `(3)` and filenames end in `_vertical_1.mp4`, `_vertical_2.mp4`, `_vertical_3.mp4`.
4. Segment 2 starts with source content from `01:55`; its first intersecting subtitle is rebased relative to `01:55`.
5. Cancelling segment 2 keeps segment 1, removes the partial segment 2, and never starts segment 3.
6. Saving/reopening a project restores enabled state, marker list, and overlap.
7. Opening an older project yields split disabled, no markers, and overlap 5.

- [ ] **Step 5: Commit documentation and verification changes when Git is available**

```bash
git add functional_specification.md system_architecture.md
git commit -m "docs: document vertical video segmentation"
```
