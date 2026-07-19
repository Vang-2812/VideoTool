# Design Document: Millisecond Storyboard Timestamp Support

## Overview
Currently, the VideoTool application supports storyboard image filenames with second-level precision formatted as `scene_{mm}_{ss}_{index}.png` or `storyboard_{mm}_{ss}_{index}.png`. 
This feature adds auto-detect support for millisecond-level precision formatted as `scene_{mm}_{ss}_{ms}_{index}.png` or `storyboard_{mm}_{ss}_{ms}_{index}.png` (e.g. `scene_01_15_500_01.png`), enabling sub-second timeline precision for video rendering.

## Requirements & Scope
1. **Auto-Detection**: Automatically parse both 3-part (`mm_ss_index`) and 4-part (`mm_ss_ms_index`) storyboard image filenames without requiring manual user toggles.
2. **Millisecond Parsing**: Calculate start time as `startTime = mm * 60 + ss + (ms || 0) / 1000`.
3. **Timeline Calculation**: Maintain float-based precision for image display durations (`duration = startTime[next] - startTime[current]`).
4. **Error Reporting**: Update skipped file reasons to inform users of both supported filename formats.

## Detailed Design

### 1. File Parser (`electron/fileParser.js`)

#### Unified Regex
Update `FILE_REGEX` to match optional millisecond component `(\d{1,3})`:
```javascript
const FILE_REGEX = /^(?:storyboard|scene)_(\d{2})_(\d{2})(?:_(\d{1,3}))?_(\d+)\.(png|jpg|jpeg)$/i;
```

#### Parsing Logic (`parseFilename`)
- Match Group 1: `mm` (minutes)
- Match Group 2: `ss` (seconds)
- Match Group 3: `ms` (milliseconds, optional, 1-3 digits). If undefined/empty, defaults to `0`.
- Match Group 4: `index` (tie-break sequence number)
- Match Group 5: `ext` (file extension)

Calculated `startTime`:
```javascript
const mm = parseInt(match[1], 10);
const ss = parseInt(match[2], 10);
const hasMs = match[3] !== undefined;
const ms = hasMs ? parseInt(match[3], 10) : 0;
const index = parseInt(match[4], 10);
const ext = match[5].toLowerCase();

const startTime = mm * 60 + ss + (ms / 1000);
```

#### Sorting & Timeline
- Sorting order: `a.startTime - b.startTime`. If `a.startTime === b.startTime`, sort by `a.index - b.index`.
- Timeline calculation: Durations are computed as differences between float `startTime` values.

#### Skipped File Warning
Update the reason string in `parseStoryboardDirectory` when a `.png`/`.jpg`/`.jpeg` file fails regex parsing:
```javascript
reason: "Tên file không đúng định dạng quy ước (scene_mm_ss_index hoặc scene_mm_ss_ms_index)"
```

## Verification Plan
1. **Unit Testing**:
   - Create unit tests verifying `parseFilename` with 3-part filenames (`scene_01_15_01.png` -> `startTime = 75.0`).
   - Verify `parseFilename` with 4-part filenames (`scene_01_15_500_01.png` -> `startTime = 75.5`).
   - Verify 4-part filenames with 1-digit or 2-digit ms (`scene_00_02_5_01.png` -> `startTime = 2.005` or `scene_00_02_50_01.png` -> `startTime = 2.05`).
   - Verify sorting of mixed 3-part and 4-part files.
2. **Build Verification**:
   - Run `npm run build` to confirm TypeScript and Vite build clean.
   - Run `npm test` to verify all test suites pass.
