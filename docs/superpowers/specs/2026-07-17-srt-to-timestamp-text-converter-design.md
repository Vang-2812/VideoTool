# Design Specification: SRT to Timestamp Text Converter (.txt)

## 1. Goal & Context
Users requested the ability to export subtitles as a timestamped text file (`.txt`) in the format:
```text
[mm:ss] subtitle line 1
[mm:ss] subtitle line 2
```
For videos over 1 hour, timestamps dynamically expand to `[hh:mm:ss]`.

This feature will be integrated directly into the **AlignerScreen** output panel upon successful forced alignment / subtitle generation.

---

## 2. Architecture & Modules

### 2.1. Timestamp Converter Module (`shared/timestampConverter.js`)
Creates a clean, testable utility function `srtToTimestampText(srtContent)`:
- Slices SRT blocks by double newlines.
- Extracts start timestamp `HH:MM:SS,mmm` and cue text.
- Formats start timestamp:
  - If `hours == 0`: `[mm:ss]` (e.g. `[01:15]`)
  - If `hours > 0`: `[hh:mm:ss]` (e.g. `[01:05:12]`)
- Formats line as `${formattedTime} ${textLines}`.
- Joins lines with `\n`.

### 2.2. User Interface Integration (`AlignerScreen.tsx`)
- Adds a **Lưu file Timestamp (.txt)** action button alongside **Lưu file SRT (.srt)**.
- Clicking **Lưu file Timestamp (.txt)**:
  - Converts `result.srtContent` using `srtToTimestampText`.
  - Saves temporary `.txt` file and prompts system save dialog via IPC.

---

## 3. Verification Plan

### Automated Tests
1. **Unit Test (`tests/timestampConverter.test.js`)**:
   - Verify standard SRT conversion to `[mm:ss] text` format.
   - Verify long duration (>1 hour) conversion to `[hh:mm:ss] text` format.
   - Verify empty or invalid SRT input handles gracefully.

### Manual Verification
1. Run subtitle aligner on a test audio file.
2. Click **Lưu file Timestamp (.txt)** and verify saved `.txt` file content matches `[mm:ss] text` format.
