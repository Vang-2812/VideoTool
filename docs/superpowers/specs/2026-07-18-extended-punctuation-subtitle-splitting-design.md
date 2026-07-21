# Subtitle Splitting by Comma and Quotes Design Spec

## Goal
Enhance the script-based sentence subtitle aligner by providing an optional setting to split sentence cues on extended punctuation (commas `,`, semicolons `;`, colons `:`, and quotation marks `'`, `"`, `“`, `”`) in addition to standard sentence endings (`.`, `!`, `?`, `\n`).

## Proposed Changes

### 1. `shared/scriptSentenceParser.js`
Update `parseScriptSentences(scriptText, options = {})` and `groupWordsByScriptSentences(alignedWords, scriptText, options = {})`:
* Support `options.splitExtendedPunctuation` (boolean, default: `false`).
* When `splitExtendedPunctuation` is `true`, use regex `/(?<=[.!?,;:])|["'”’‘“]|\r?\n/` to split sentences.
* Filter out empty sentence blocks (blocks that contain 0 words after trimming punctuation) so word indexing remains 1-to-1 matched with aligned words.

### 2. `electron/main.js`
* Update `align-audio-and-script` IPC handler to receive `splitExtendedPunctuation`.
* Pass `options: { splitExtendedPunctuation }` to `groupWordsByScriptSentences`.

### 3. `src/components/AlignerScreen.tsx` & `src/electron.d.ts`
* Add `splitExtendedPunctuation` state to `AlignerScreen.tsx`.
* Render a checkbox under "Từng câu (Sentence)" option when selected: `[x] Tách thêm câu theo dấu phẩy (,) và dấu nháy (', ")`.
* Persist `splitExtendedPunctuation` in `localStorage` (`aligner_split_extended_punct`).
* Pass `splitExtendedPunctuation` to `window.electronAPI.alignAudioAndScript`.

## Verification Plan
* Add unit tests in `tests/scriptSentenceParser.test.js` to verify extended punctuation splitting logic.
* Run `npm test` to ensure zero regressions.
* Run `npm run build` to verify TypeScript types and UI build.
