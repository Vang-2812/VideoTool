# Script-First Sentence Subtitle Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure sentence-level subtitles (`srtLevel === 'sentence'`) created with a user-provided script match 1-to-1 with the script's sentences/lines, with `start` timestamp set to the first word's start time and `end` timestamp set to the last word's end time.

**Architecture:** Create a utility `shared/scriptSentenceParser.js` that parses the script into sentence units and maps aligned word timestamps back to complete script sentences. Integrate this helper into `electron/main.js` for both Forced Aligner and Concat-and-Align flows while preserving the existing word-chunking fallback for script-less (Pure Transcribe) mode.

**Tech Stack:** Node.js (ES Modules), Node Test Runner (`node --test`), Electron IPC.

## Global Constraints

- **Language Support:** Handles Vietnamese and English punctuation (`.`, `!`, `?`) and line breaks (`\n`, `\r\n`).
- **Mode Isolation:** Only apply script sentence grouping when `srtLevel === 'sentence'` AND `scriptText` is provided. Pure Transcribe mode (`transcribeOnly === true`) retains existing 8-word / 40-char fallback chunking.

---

### Task 1: Create `shared/scriptSentenceParser.js` with Unit Tests

**Files:**
- Create: `shared/scriptSentenceParser.js`
- Create: `tests/scriptSentenceParser.test.js`

**Interfaces:**
- Produces:
  - `parseScriptSentences(scriptText: string): Array<{ text: string, words: string[] }>`
  - `groupWordsByScriptSentences(alignedWords: Array<{ word: string, start: number, end: number }>, scriptText: string): Array<{ text: string, start: number, end: number }>`

- [ ] **Step 1: Write failing unit test for `scriptSentenceParser`**

Create `tests/scriptSentenceParser.test.js`:

```javascript
import test from 'node.test';
import assert from 'node:assert/strict';
import { parseScriptSentences, groupWordsByScriptSentences } from '../shared/scriptSentenceParser.js';

test('parseScriptSentences splits by punctuation and newlines correctly', () => {
  const script = "The river is gone. The mud is cracking!\nYour tongue feels too large.";
  const sentences = parseScriptSentences(script);
  assert.equal(sentences.length, 3);
  assert.equal(sentences[0].text, "The river is gone.");
  assert.equal(sentences[1].text, "The mud is cracking!");
  assert.equal(sentences[2].text, "Your tongue feels too large.");
});

test('groupWordsByScriptSentences maps aligned word timestamps to script sentences', () => {
  const script = "The river is gone. The mud is cracking!";
  const alignedWords = [
    { word: 'The', start: 0.1, end: 0.3 },
    { word: 'river', start: 0.3, end: 0.6 },
    { word: 'is', start: 0.6, end: 0.8 },
    { word: 'gone.', start: 0.8, end: 1.2 },
    { word: 'The', start: 1.5, end: 1.7 },
    { word: 'mud', start: 1.7, end: 2.0 },
    { word: 'is', start: 2.0, end: 2.2 },
    { word: 'cracking!', start: 2.2, end: 2.8 }
  ];

  const result = groupWordsByScriptSentences(alignedWords, script);
  assert.equal(result.length, 2);
  assert.equal(result[0].text, "The river is gone.");
  assert.equal(result[0].start, 0.1);
  assert.equal(result[0].end, 1.2);

  assert.equal(result[1].text, "The mud is cracking!");
  assert.equal(result[1].start, 1.5);
  assert.equal(result[1].end, 2.8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scriptSentenceParser.test.js`
Expected: FAIL with module not found error.

- [ ] **Step 3: Implement `shared/scriptSentenceParser.js`**

Create `shared/scriptSentenceParser.js`:

```javascript
/**
 * Utility functions for parsing script text into sentences and mapping aligned word timestamps.
 */

/**
 * Splits script text into distinct sentence blocks based on punctuation (. ! ?) and newlines (\n).
 * Preserves exact sentence text.
 */
export function parseScriptSentences(scriptText) {
  if (!scriptText || !scriptText.trim()) return [];

  const text = scriptText.trim();
  const rawSegments = text.split(/(?<=[.!?])|\r?\n/);
  const sentences = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (trimmed.length > 0) {
      sentences.push({
        text: trimmed,
        words: trimmed.split(/\s+/).filter(Boolean)
      });
    }
  }

  return sentences;
}

/**
 * Groups aligned words into subtitle cues matching the original script sentences 1:1.
 */
export function groupWordsByScriptSentences(alignedWords, scriptText) {
  const sentences = parseScriptSentences(scriptText);
  if (sentences.length === 0 || !alignedWords || alignedWords.length === 0) {
    return [];
  }

  const cues = [];
  let wordPointer = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.words.length;
    if (wordCount === 0) continue;

    const sentenceAlignedWords = [];
    for (let k = 0; k < wordCount && wordPointer < alignedWords.length; k++) {
      sentenceAlignedWords.push(alignedWords[wordPointer]);
      wordPointer++;
    }

    if (sentenceAlignedWords.length > 0) {
      const startTime = sentenceAlignedWords[0].start;
      const endTime = sentenceAlignedWords[sentenceAlignedWords.length - 1].end;
      cues.push({
        text: sentence.text,
        start: startTime,
        end: endTime
      });
    }
  }

  return cues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scriptSentenceParser.test.js`
Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add shared/scriptSentenceParser.js tests/scriptSentenceParser.test.js
git commit -m "feat: add script sentence parser and timestamp mapper utility"
```

---

### Task 2: Integrate Script Sentence Alignment into `electron/main.js`

**Files:**
- Modify: `electron/main.js:1327-1398` and `electron/main.js:1180-1290`

**Interfaces:**
- Consumes: `groupWordsByScriptSentences` from `shared/scriptSentenceParser.js`
- Produces: Updated IPC handlers `align-audio-and-script` and `concat-and-align` with script-first sentence grouping logic.

- [ ] **Step 1: Write a failing test for main integration in `tests/`**

Create `tests/mainSentenceAlign.test.js`:

```javascript
import test from 'node.test';
import assert from 'node:assert/strict';
import { groupWordsByScriptSentences } from '../shared/scriptSentenceParser.js';

test('Sentence grouping uses script sentences when script is provided', () => {
  const scriptText = "Sentence one is here. Sentence two follows it.";
  const alignedWords = [
    { word: 'Sentence', start: 0.0, end: 0.5 },
    { word: 'one', start: 0.5, end: 0.8 },
    { word: 'is', start: 0.8, end: 1.0 },
    { word: 'here.', start: 1.0, end: 1.5 },
    { word: 'Sentence', start: 1.8, end: 2.2 },
    { word: 'two', start: 2.2, end: 2.5 },
    { word: 'follows', start: 2.5, end: 2.9 },
    { word: 'it.', start: 2.9, end: 3.4 }
  ];

  const result = groupWordsByScriptSentences(alignedWords, scriptText);
  assert.equal(result.length, 2);
  assert.equal(result[0].text, "Sentence one is here.");
  assert.equal(result[0].start, 0.0);
  assert.equal(result[0].end, 1.5);

  assert.equal(result[1].text, "Sentence two follows it.");
  assert.equal(result[1].start, 1.8);
  assert.equal(result[1].end, 3.4);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/mainSentenceAlign.test.js`
Expected: PASS

- [ ] **Step 3: Update `electron/main.js` IPC handlers**

Import `groupWordsByScriptSentences` in `electron/main.js`:
```javascript
import { groupWordsByScriptSentences } from '../shared/scriptSentenceParser.js';
```

In `align-audio-and-script` handler (`electron/main.js` around line 1370):
```javascript
    // Gộp câu nếu srtLevel là 'sentence'
    if (srtLevel === 'sentence') {
      if (!transcribeOnly && scriptText && scriptText.trim()) {
        finalCues = groupWordsByScriptSentences(finalCues, scriptText.trim());
      } else {
        finalCues = groupWordsIntoSentences(finalCues);
      }
    }
```

In `concat-and-align` handler (`electron/main.js` around line 1275):
```javascript
    const alignment = alignScriptAndWhisper(fullText, whisperResult.words, audioDuration);
    const finalCues = groupWordsByScriptSentences(alignment.words, fullText);
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS all tests.

- [ ] **Step 5: Run production build check**

Run: `npm run build`
Expected: Vite build completes cleanly.

- [ ] **Step 6: Commit**

```bash
git add electron/main.js tests/mainSentenceAlign.test.js
git commit -m "feat: integrate script-first sentence grouping into IPC handlers"
```
