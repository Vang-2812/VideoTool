# Millisecond Storyboard Timestamp Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable auto-detect support for millisecond-level precision formatted storyboard image filenames (`scene_{mm}_{ss}_{ms}_{index}.png` / `storyboard_{mm}_{ss}_{ms}_{index}.png`) alongside existing 3-part filenames.

**Architecture:** Update `FILE_REGEX` in `electron/fileParser.js` with an optional 1-3 digit millisecond capture group `(?:_(\d{1,3}))?`. Update `parseFilename` to calculate float-precision start times `mm * 60 + ss + (ms / 1000)`. Update skipped file error messages.

**Tech Stack:** Node.js, Electron, Vitest (`npm test`).

## Global Constraints

- Preserve 3-part filename support (`scene_mm_ss_index.png`) without breaking backward compatibility.
- Seamless auto-detection for both 3-part and 4-part filenames in the same directory.
- `startTime` must be computed as floating point seconds (`number`).

---

### Task 1: Update Regex and Parsing Logic in `electron/fileParser.js`

**Files:**
- Modify: `electron/fileParser.js:4-30`
- Modify: `electron/fileParser.js:170-176`
- Create: `tests/fileParser.test.js`

**Interfaces:**
- Consumes: `filename: string`
- Produces: `parseFilename(filename)` returning `{ mm: number, ss: number, ms: number, index: number, ext: string, startTime: number }` or `null`.

- [ ] **Step 1: Write failing unit test for 3-part and 4-part filename parsing**

Create `tests/fileParser.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { parseFilename } from '../electron/fileParser.js';

describe('parseFilename', () => {
  it('parses 3-part filename without ms correctly', () => {
    const result = parseFilename('scene_01_15_03.png');
    expect(result).toEqual({
      mm: 1,
      ss: 15,
      ms: 0,
      index: 3,
      ext: 'png',
      startTime: 75
    });
  });

  it('parses 4-part filename with 3-digit ms correctly', () => {
    const result = parseFilename('scene_01_15_500_03.png');
    expect(result).toEqual({
      mm: 1,
      ss: 15,
      ms: 500,
      index: 3,
      ext: 'png',
      startTime: 75.5
    });
  });

  it('parses storyboard_ prefix with ms correctly', () => {
    const result = parseFilename('storyboard_00_02_050_01.jpg');
    expect(result).toEqual({
      mm: 0,
      ss: 2,
      ms: 50,
      index: 1,
      ext: 'jpg',
      startTime: 2.05
    });
  });

  it('returns null for invalid filename formats', () => {
    expect(parseFilename('invalid_file.png')).toBeNull();
    expect(parseFilename('scene_01_png')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fileParser.test.js`
Expected: FAIL (because `parseFilename` currently fails on 4-part filenames and does not return `ms`).

- [ ] **Step 3: Update `electron/fileParser.js` regex and `parseFilename` function**

Modify `electron/fileParser.js`:
```javascript
// REGEX according to FR-2.2.1 (supports storyboard_ or scene_ with optional ms)
const FILE_REGEX = /^(?:storyboard|scene)_(\d{2})_(\d{2})(?:_(\d{1,3}))?_(\d+)\.(png|jpg|jpeg)$/i;
const DEFAULT_MIN_DURATION = 0.5; // FR-3.3.2 default (configurable)

/**
 * Parses a single filename based on the regex.
 * Returns parsed object or null if invalid format.
 */
export function parseFilename(filename) {
  const match = filename.match(FILE_REGEX);
  if (!match) return null;

  const mm = parseInt(match[1], 10);
  const ss = parseInt(match[2], 10);
  const hasMs = match[3] !== undefined;
  const ms = hasMs ? parseInt(match[3], 10) : 0;
  const index = parseInt(match[4], 10);
  const ext = match[5].toLowerCase();

  return {
    mm,
    ss,
    ms,
    index,
    ext,
    startTime: mm * 60 + ss + (ms / 1000)
  };
}
```

Also update skipped file reason around line 173:
```javascript
reason: "Tên file không đúng định dạng quy ước (scene_mm_ss_index hoặc scene_mm_ss_ms_index)"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fileParser.test.js`
Expected: PASS

- [ ] **Step 5: Run full test suite & build check**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add electron/fileParser.js tests/fileParser.test.js
git commit -m "feat: add millisecond storyboard timestamp parsing support"
```
