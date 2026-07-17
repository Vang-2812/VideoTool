# Fix Video File Picker Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where clicking "Chọn Video" in `ReupScreen.tsx` (and `VerticalConvertScreen.tsx`) opens an audio file picker dialog instead of a video file picker dialog.

**Architecture:**
- `electron/main.js`: Register `select-video-file` IPC handler with title "Chọn tệp Video nguồn" and video extensions (`.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.flv`, `.wmv`).
- `electron/preload.cjs`: Expose `selectVideoFile` in `electronAPI`.
- `src/electron.d.ts`: Add TypeScript definitions for `selectVideoFile`.
- `src/components/ReupScreen.tsx`: Call `window.electronAPI.selectVideoFile()` in `handleSelectVideo`.
- `src/components/VerticalConvertScreen.tsx`: Call `window.electronAPI.selectVideoFile()` in `handleSelectVideo`.

---

### Task 1: Add `selectVideoFile` IPC & Type Definitions

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.cjs`
- Modify: `src/electron.d.ts`

- [ ] **Step 1: Add `select-video-file` handler in `electron/main.js`**

Add right after `select-audio-file`:
```javascript
ipcMain.handle('select-video-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv'] }],
    title: 'Chọn tệp Video nguồn'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return {
    path: filePath,
    name: path.basename(filePath)
  };
});
```

- [ ] **Step 2: Expose `selectVideoFile` in `electron/preload.cjs`**

Add `selectVideoFile: () => ipcRenderer.invoke('select-video-file'),`

- [ ] **Step 3: Add type definition in `src/electron.d.ts`**

Add `selectVideoFile: () => Promise<{ path: string; name: string } | null>;`

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/preload.cjs src/electron.d.ts
git commit -m "feat: add select-video-file IPC handler and preload bindings"
```

---

### Task 2: Update React Components to Use `selectVideoFile`

**Files:**
- Modify: `src/components/ReupScreen.tsx`
- Modify: `src/components/VerticalConvertScreen.tsx`

- [ ] **Step 1: Update `src/components/ReupScreen.tsx`**

In `handleSelectVideo`:
Change `window.electronAPI.selectAudioFile()` -> `window.electronAPI.selectVideoFile()`.

- [ ] **Step 2: Update `src/components/VerticalConvertScreen.tsx`**

In `handleSelectVideo`:
Change `window.electronAPI.selectRelinkFile(['mp4'])` -> `window.electronAPI.selectVideoFile()`.

- [ ] **Step 3: Verify build & tests**

Run `npm test && npm run build`
Expected: PASS 100%

- [ ] **Step 4: Commit**

```bash
git add src/components/ReupScreen.tsx src/components/VerticalConvertScreen.tsx
git commit -m "fix: update video pickers to use selectVideoFile API"
```
