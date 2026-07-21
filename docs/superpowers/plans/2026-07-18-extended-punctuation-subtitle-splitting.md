# Extended Punctuation Subtitle Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable option to split script sentences on extended punctuation (commas `,`, semicolons `;`, colons `:`, and quotes `'`, `"`, `“`, `”`) in addition to sentence-ending punctuation when aligning subtitles.

**Architecture:** Extend `parseScriptSentences` and `groupWordsByScriptSentences` in `shared/scriptSentenceParser.js` to accept an `options` parameter (`{ splitExtendedPunctuation: true/false }`). Connect this option from `AlignerScreen.tsx` UI -> `electron/main.js` IPC handler -> `scriptSentenceParser.js`.

**Tech Stack:** JavaScript (ES Modules), React, Node.js, Electron IPC, Node test runner (`node --test`).

## Global Constraints

- Preserve exact word timestamp mapping between `alignedWords` and output subtitle cues.
- Default behavior must remain `splitExtendedPunctuation: false` (backwards-compatible).
- Automatically persist user preference in `localStorage`.

---

### Task 1: Extend `scriptSentenceParser.js` and add unit tests

**Files:**
- Modify: `shared/scriptSentenceParser.js`
- Modify: `tests/scriptSentenceParser.test.js`

**Interfaces:**
- Consumes: None
- Produces: `parseScriptSentences(scriptText, options = {})`, `groupWordsByScriptSentences(alignedWords, scriptText, options = {})`

- [ ] **Step 1: Write the failing test**

In `tests/scriptSentenceParser.test.js`, add test cases for extended punctuation splitting:

```javascript
test('parseScriptSentences splits by extended punctuation when enabled', () => {
  const script = 'Xin chào, tôi là AI! "Đây là ví dụ," anh nói.';
  const sentences = parseScriptSentences(script, { splitExtendedPunctuation: true });

  assert.strictEqual(sentences.length, 4);
  assert.strictEqual(sentences[0].text, 'Xin chào,');
  assert.strictEqual(sentences[1].text, 'tôi là AI!');
  assert.strictEqual(sentences[2].text, 'Đây là ví dụ,');
  assert.strictEqual(sentences[3].text, 'anh nói.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scriptSentenceParser.test.js`
Expected: FAIL due to `sentences.length` being 2 instead of 4.

- [ ] **Step 3: Update `shared/scriptSentenceParser.js` implementation**

```javascript
export function parseScriptSentences(scriptText, options = {}) {
  if (!scriptText || !scriptText.trim()) return [];

  const text = scriptText.trim();
  const regex = options.splitExtendedPunctuation
    ? /(?<=[.!?,;:])|["'”’‘“]|\r?\n/
    : /(?<=[.!?])|\r?\n/;

  const rawSegments = text.split(regex);
  const sentences = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      sentences.push({
        text: trimmed,
        words: words
      });
    }
  }

  return sentences;
}

export function groupWordsByScriptSentences(alignedWords, scriptText, options = {}) {
  const sentences = parseScriptSentences(scriptText, options);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/scriptSentenceParser.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/scriptSentenceParser.js tests/scriptSentenceParser.test.js
git commit -m "feat: support extended punctuation splitting in scriptSentenceParser"
```

---

### Task 2: Connect Option to `electron/main.js` and `AlignerScreen.tsx` UI

**Files:**
- Modify: `electron/main.js`
- Modify: `src/components/AlignerScreen.tsx`
- Modify: `src/electron.d.ts`

**Interfaces:**
- Consumes: `groupWordsByScriptSentences(alignedWords, scriptText, options)`
- Produces: UI Checkbox for `splitExtendedPunctuation` & IPC payload handling.

- [ ] **Step 1: Update `electron/main.js` IPC handler**

In `electron/main.js`, update `align-audio-and-script` IPC handler:

```javascript
ipcMain.handle('align-audio-and-script', async (event, { audioPath, scriptText, useCloud, transcribeOnly, srtLevel, splitExtendedPunctuation }) => {
  // ...
  // When grouping by script sentences:
  const sentenceCues = groupWordsByScriptSentences(alignment.words, fullText, { splitExtendedPunctuation });
```

- [ ] **Step 2: Update `src/components/AlignerScreen.tsx` and `src/electron.d.ts`**

In `src/components/AlignerScreen.tsx`:
- Add `const [splitExtendedPunctuation, setSplitExtendedPunctuation] = useState(false);`
- Load from `localStorage.getItem('aligner_split_extended_punct') === 'true'`
- Save to `localStorage.setItem('aligner_split_extended_punct', String(splitExtendedPunctuation))`
- Add checkbox UI under "Từng câu (Sentence)" option:
```tsx
{srtLevel === 'sentence' && (
  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer mt-2.5 pl-1 select-none">
    <input
      type="checkbox"
      checked={splitExtendedPunctuation}
      onChange={(e) => setSplitExtendedPunctuation(e.target.checked)}
      className="w-4 h-4 accent-primary rounded cursor-pointer"
    />
    <span>Tách thêm câu theo dấu phẩy (,) và dấu nháy (', ")</span>
  </label>
)}
```
- Pass `splitExtendedPunctuation` to `window.electronAPI.alignAudioAndScript({ ..., splitExtendedPunctuation })`.

In `src/electron.d.ts`:
Update `alignAudioAndScript` signature:
```typescript
alignAudioAndScript: (params: {
  audioPath: string;
  scriptText?: string;
  useCloud?: boolean;
  transcribeOnly?: boolean;
  srtLevel?: 'sentence' | 'word';
  splitExtendedPunctuation?: boolean;
}) => Promise<any>;
```

- [ ] **Step 3: Run build and type check**

Run: `npm run build`
Expected: Build succeeds without TS or bundling errors.

- [ ] **Step 4: Commit**

```bash
git add electron/main.js src/components/AlignerScreen.tsx src/electron.d.ts
git commit -m "feat: add splitExtendedPunctuation checkbox UI and IPC integration"
```
