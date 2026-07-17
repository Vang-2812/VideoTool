# Design Specification: Fix Video File Picker Dialog Bug

## 1. Problem Description
In `ReupScreen.tsx`, clicking the "Chọn Video" button invokes `window.electronAPI.selectAudioFile()`. This opens an Electron native open file dialog titled "Chọn file Audio chính" that only filters for audio files (`.mp3`, `.wav`). The user cannot select video files (`.mp4`, `.mov`, `.mkv`, etc.).

## 2. Solution Specification

### 2.1. Electron Main Process (`electron/main.js`)
Add a dedicated `select-video-file` IPC handler:
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

### 2.2. Preload Bridge (`electron/preload.cjs`)
Expose `selectVideoFile`:
```javascript
selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
```

### 2.3. Type Declarations (`src/electron.d.ts`)
Add type signature:
```typescript
selectVideoFile: () => Promise<{ path: string; name: string } | null>;
```

### 2.4. React Components
- `src/components/ReupScreen.tsx`: Update `handleSelectVideo` to call `window.electronAPI.selectVideoFile()`.
- `src/components/VerticalConvertScreen.tsx`: Update `handleSelectVideo` to call `window.electronAPI.selectVideoFile()`.

---

## 3. Verification
- Run `npm test` and `npm run build`.
- Verify file dialog opens with "Chọn tệp Video nguồn" and allows selecting video files.
