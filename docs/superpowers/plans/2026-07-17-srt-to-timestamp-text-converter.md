# SRT to Timestamp Text Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an option in `AlignerScreen.tsx` to export generated subtitles directly as a timestamped text file (`.txt`) formatted as `[mm:ss] subtitle text` (or `[hh:mm:ss] subtitle text` for videos $\ge$ 1 hour).

**Architecture:** Create a `shared/timestampConverter.js` utility that parses SRT text blocks and converts start timestamps to formatted bracketed time strings. Update `AlignerScreen.tsx` with a **Lưu file Timestamp (.txt)** action button that uses this helper.

**Tech Stack:** Node.js (ES Modules), React + TypeScript, Node Test Runner (`node --test`).

## Global Constraints

- **Timestamp Formatting:** 
  - Video duration < 1 hour: `[mm:ss]` (e.g. `[01:15]`)
  - Video duration $\ge$ 1 hour: `[hh:mm:ss]` (e.g. `[01:05:12]`)
- **Lossless Handling:** Preserve full cue text without stripping Vietnamese characters or punctuation.

---

### Task 1: Create `shared/timestampConverter.js` with Unit Tests

**Files:**
- Create: `shared/timestampConverter.js`
- Create: `tests/timestampConverter.test.js`

**Interfaces:**
- Produces:
  - `srtToTimestampText(srtContent: string): string`

- [ ] **Step 1: Write failing test in `tests/timestampConverter.test.js`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { srtToTimestampText } from '../shared/timestampConverter.js';

test('srtToTimestampText converts standard SRT cues to [mm:ss] format', () => {
  const srt = `1
00:01:15,000 --> 00:01:20,000
The river is gone.

2
00:02:05,500 --> 00:02:10,000
The mud is cracking!`;

  const result = srtToTimestampText(srt);
  const lines = result.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '[01:15] The river is gone.');
  assert.equal(lines[1], '[02:05] The mud is cracking!');
});

test('srtToTimestampText converts long video SRT cues to [hh:mm:ss] format', () => {
  const srt = `1
01:15:22,100 --> 01:15:30,000
Over an hour scene.`;

  const result = srtToTimestampText(srt);
  assert.equal(result.trim(), '[01:15:22] Over an hour scene.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/timestampConverter.test.js`
Expected: FAIL with module not found error.

- [ ] **Step 3: Implement `shared/timestampConverter.js`**

```javascript
/**
 * Utility to convert SRT subtitle content into timestamp text format: [mm:ss] text
 */
export function srtToTimestampText(srtContent) {
  if (!srtContent || !srtContent.trim()) return '';

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const lines = [];

  for (const block of blocks) {
    const parts = block.trim().split('\n');
    if (parts.length < 3) continue;

    const timeLine = parts[1];
    const textLines = parts.slice(2).join(' ').trim();

    const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2}),\d{3}\s*-->/);
    if (!timeMatch) continue;

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);

    let formattedTime = '';
    if (hours > 0) {
      const totalHours = String(hours).padStart(2, '0');
      const totalMinutes = String(minutes).padStart(2, '0');
      const totalSecs = String(seconds).padStart(2, '0');
      formattedTime = `[${totalHours}:${totalMinutes}:${totalSecs}]`;
    } else {
      const totalMinutes = String(minutes).padStart(2, '0');
      const totalSecs = String(seconds).padStart(2, '0');
      formattedTime = `[${totalMinutes}:${totalSecs}]`;
    }

    lines.push(`${formattedTime} ${textLines}`);
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/timestampConverter.test.js`
Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add shared/timestampConverter.js tests/timestampConverter.test.js
git commit -m "feat: add SRT to timestamp text converter utility"
```

---

### Task 2: Integrate Timestamp Export Button into `AlignerScreen.tsx`

**Files:**
- Modify: `src/components/AlignerScreen.tsx:415-438`

**Interfaces:**
- Consumes: `srtToTimestampText` from `../../shared/timestampConverter.js`

- [ ] **Step 1: Update `AlignerScreen.tsx` to add `handleSaveTimestampText` handler and button**

Import `srtToTimestampText`:
```typescript
import { srtToTimestampText } from '../../shared/timestampConverter';
```

Add handler inside `AlignerScreen`:
```typescript
  const handleSaveTimestampText = async () => {
    if (!result?.srtContent) return;
    const txtContent = srtToTimestampText(result.srtContent);
    
    // Save via temp path helper
    const tempPath = await window.electronAPI.getTempPath();
    const txtTempPath = tempPath.replace(/\.[^/.]+$/, '') + '_timestamp.txt';
    
    // Save content to temp txt file via IPC
    const alignRes = await window.electronAPI.saveFileFromTemp({
      sourcePath: result.srtPath,
      filterName: 'Timestamp Text',
      extension: 'txt'
    });
  };
```

Update action buttons row in `AlignerScreen.tsx`:
```tsx
                {/* Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {audioFile && (
                    <button
                      onClick={() => handlePlayAudio(audioFile.path)}
                      className="py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Nghe thử Audio
                    </button>
                  )}
                  <button
                    onClick={handleSaveSrt}
                    className="py-2.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 hover:text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Lưu file SRT (.srt)
                  </button>
                  <button
                    onClick={handleSaveTimestampText}
                    className="py-2.5 bg-accent/10 hover:bg-accent/25 border border-accent/20 hover:border-accent/45 text-accent text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Lưu Timestamp (.txt)
                  </button>
                </div>
```

- [ ] **Step 2: Run test suite**

Run: `npm test`
Expected: PASS all tests.

- [ ] **Step 3: Run production build check**

Run: `npm run build`
Expected: Vite build completes cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/components/AlignerScreen.tsx
git commit -m "feat: add Save Timestamp Text (.txt) button to AlignerScreen"
```
