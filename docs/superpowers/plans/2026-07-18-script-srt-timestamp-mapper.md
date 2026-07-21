# Script - SRT Timestamp Mapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a utility and UI component in the Aligner Screen that maps paragraph/line segments of a script to their exact start timestamps in a word-level SRT file, outputting formatted timestamps with optional millisecond precision.

**Architecture:** Extend `shared/timestampConverter.js` with `mapScriptToSrtTimestamps`, add an IPC handler `map-script-to-srt` in `electron/main.js`, and add a Sub-tab view in `src/components/AlignerScreen.tsx`.

**Tech Stack:** JavaScript (ES Modules), React, Node.js, Electron IPC, Node test runner (`node --test`).

## Global Constraints

- Preserve exact paragraph formatting from the input script.
- Rounding rule for `includeMs: false`: if milliseconds $\ge 500$, $+1\text{s}$, else keep seconds.
- Format for `includeMs: false`: `[mm:ss]` or `[hh:mm:ss]`.
- Format for `includeMs: true`: `[mm:ss:fff]` or `[hh:mm:ss:fff]`.

---

### Task 1: Implement `mapScriptToSrtTimestamps` & Unit Tests

**Files:**
- Modify: `shared/timestampConverter.js`
- Modify: `tests/timestampConverter.test.js`

**Interfaces:**
- Consumes: None
- Produces: `mapScriptToSrtTimestamps(scriptText: string, srtContent: string, options?: { includeMs?: boolean }): string`

- [ ] **Step 1: Write the failing unit tests**

In `tests/timestampConverter.test.js`, add test cases for `mapScriptToSrtTimestamps`:

```javascript
test('mapScriptToSrtTimestamps maps script paragraphs to SRT word timestamps without ms (rounding >=500ms)', () => {
  const script = "Okay, so you want to own a casino.\n\nYou picture the front doors opening,";
  const srt = `1\n00:00:00,120 --> 00:00:00,450\nOkay,\n\n2\n00:00:00,460 --> 00:00:00,600\nso\n\n3\n00:00:02,600 --> 00:00:02,900\nYou\n\n4\n00:00:02,950 --> 00:00:03,100\npicture`;

  const result = mapScriptToSrtTimestamps(script, srt, { includeMs: false });
  assert.equal(result, "[00:00] Okay, so you want to own a casino.\n\n[00:03] You picture the front doors opening,");
});

test('mapScriptToSrtTimestamps maps script paragraphs to SRT word timestamps with ms', () => {
  const script = "Okay, so you want to own a casino.\n\nYou picture the front doors opening,";
  const srt = `1\n00:00:00,120 --> 00:00:00,450\nOkay,\n\n2\n00:00:00,460 --> 00:00:00,600\nso\n\n3\n00:00:02,234 --> 00:00:02,900\nYou\n\n4\n00:00:02,950 --> 00:00:03,100\npicture`;

  const result = mapScriptToSrtTimestamps(script, srt, { includeMs: true });
  assert.equal(result, "[00:00:120] Okay, so you want to own a casino.\n\n[00:02:234] You picture the front doors opening,");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/timestampConverter.test.js`
Expected: FAIL due to `mapScriptToSrtTimestamps` not being defined.

- [ ] **Step 3: Implement `mapScriptToSrtTimestamps` in `shared/timestampConverter.js`**

```javascript
export function parseSrtWordCues(srtContent) {
  if (!srtContent || !srtContent.trim()) return [];

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const parts = block.trim().split('\n');
    if (parts.length < 3) continue;

    const timeLine = parts[1];
    const textLines = parts.slice(2).join(' ').trim();

    const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->/);
    if (!timeMatch) continue;

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    const ms = parseInt(timeMatch[4], 10);

    const startMs = hours * 3600000 + minutes * 6000 + seconds * 1000 + ms;
    const cleanWord = textLines.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

    cues.push({
      text: textLines,
      cleanWord,
      startMs,
      hours,
      minutes,
      seconds,
      ms
    });
  }

  return cues;
}

export function formatMsTimestamp(totalMs, includeMs = false) {
  let totalSecs = Math.floor(totalMs / 1000);
  const remMs = totalMs % 1000;

  if (!includeMs) {
    if (remMs >= 500) {
      totalSecs += 1;
    }
  }

  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const msStr = String(remMs).padStart(3, '0');
  const sStr = String(s).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  const hStr = String(h).padStart(2, '0');

  if (includeMs) {
    return h > 0 ? `[${hStr}:${mStr}:${sStr}:${msStr}]` : `[${mStr}:${sStr}:${msStr}]`;
  } else {
    return h > 0 ? `[${hStr}:${mStr}:${sStr}]` : `[${mStr}:${sStr}]`;
  }
}

export function mapScriptToSrtTimestamps(scriptText, srtContent, options = {}) {
  if (!scriptText || !scriptText.trim() || !srtContent || !srtContent.trim()) {
    return scriptText || '';
  }

  const srtCues = parseSrtWordCues(srtContent);
  if (srtCues.length === 0) return scriptText;

  const includeMs = !!options.includeMs;
  const rawParagraphs = scriptText.split(/(\r?\n)/);
  const resultLines = [];
  let srtIndex = 0;

  for (const item of rawParagraphs) {
    if (/^\r?\n$/.test(item)) {
      resultLines.push('');
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      resultLines.push(item);
      continue;
    }

    const firstWordClean = words[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    let matchedMs = null;

    for (let k = srtIndex; k < srtCues.length; k++) {
      if (srtCues[k].cleanWord === firstWordClean) {
        matchedMs = srtCues[k].startMs;
        srtIndex = k + words.length;
        break;
      }
    }

    if (matchedMs === null && srtIndex < srtCues.length) {
      matchedMs = srtCues[srtIndex].startMs;
      srtIndex += words.length;
    }

    if (matchedMs !== null) {
      const tsTag = formatMsTimestamp(matchedMs, includeMs);
      resultLines.push(`${tsTag} ${trimmed}`);
    } else {
      resultLines.push(trimmed);
    }
  }

  return resultLines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/timestampConverter.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/timestampConverter.js tests/timestampConverter.test.js
git commit -m "feat: add mapScriptToSrtTimestamps utility and tests"
```

---

### Task 2: Add IPC Handler in `electron/main.js` and `preload.cjs`

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.cjs`
- Modify: `src/electron.d.ts`

**Interfaces:**
- Consumes: `mapScriptToSrtTimestamps(scriptText, srtContent, { includeMs })`
- Produces: `window.electronAPI.mapScriptToSrt`

- [ ] **Step 1: Add `map-script-to-srt` IPC handler in `electron/main.js`**

```javascript
ipcMain.handle('map-script-to-srt', async (event, { scriptText, srtPath, srtContent, includeMs }) => {
  try {
    let content = srtContent;
    if (!content && srtPath) {
      content = await fs.readFile(srtPath, 'utf-8');
    }
    if (!content) {
      return { success: false, error: 'File SRT trống hoặc không hợp lệ.' };
    }
    const formattedText = mapScriptToSrtTimestamps(scriptText, content, { includeMs });
    return { success: true, formattedText };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Update `preload.cjs` and `electron.d.ts`**

In `electron/preload.cjs`:
```javascript
mapScriptToSrt: (params) => ipcRenderer.invoke('map-script-to-srt', params),
```

In `src/electron.d.ts`:
```typescript
mapScriptToSrt: (params: {
  scriptText: string;
  srtPath?: string;
  srtContent?: string;
  includeMs?: boolean;
}) => Promise<{ success: boolean; formattedText?: string; error?: string }>;
```

- [ ] **Step 3: Run build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/preload.cjs src/electron.d.ts
git commit -m "feat: add map-script-to-srt IPC handler and types"
```

---

### Task 3: Build UI in `src/components/AlignerScreen.tsx`

**Files:**
- Modify: `src/components/AlignerScreen.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.mapScriptToSrt`, `window.electronAPI.selectSavePath`
- Produces: Sub-tab switcher + Mapper UI panel.

- [ ] **Step 1: Add Sub-Tab navigation and Mapper state**

In `src/components/AlignerScreen.tsx`:
- Add state `const [subTab, setSubTab] = useState<'aligner' | 'mapper'>('aligner');`
- Add Mapper states:
  - `const [mapperScript, setMapperScript] = useState('');`
  - `const [mapperSrtFile, setMapperSrtFile] = useState<{ path: string; name: string } | null>(null);`
  - `const [mapperIncludeMs, setMapperIncludeMs] = useState(false);`
  - `const [mapperResult, setMapperResult] = useState('');`
  - `const [isMapping, setIsMapping] = useState(false);`

- [ ] **Step 2: Implement Mapper Tab UI and handlers**

- Handle SRT selection: `window.electronAPI.selectSrtFile()` or `selectAudioFile` fallback if `.srt` filter supported.
- Handle Mapping execution: call `window.electronAPI.mapScriptToSrt`.
- Render Sub-tab switcher buttons at the top of `AlignerScreen`:
  - `[ Căn Lề Phụ Đề từ Audio (Aligner) ]`
  - `[ Mapping Timestamp Script (từ SRT) ]`
- Render Mapper panel when `subTab === 'mapper'`.

- [ ] **Step 3: Run build and tests**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/AlignerScreen.tsx
git commit -m "feat: add Script-SRT Timestamp Mapper UI and sub-tab to AlignerScreen"
```
