# Legacy TTS Models Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add support for Google Cloud Legacy TTS Models (WaveNet, Studio, Standard, Neural2, Polyglot) dynamically via the existing OAuth authentication.

**Architecture:** A new IPC endpoint will be added to the Electron backend to fetch voices from the Google TTS API. The frontend will present a new `legacy` mode, where users can filter these fetched voices by engine type and select a specific voice instance. The `ttsJobOrchestrator` will route `legacy` jobs as standard `cloud-rest` calls using the selected `voiceName`.

**Tech Stack:** React, Electron, Google Cloud TTS API

## Global Constraints

- Must use the exact same Google Cloud authentication already present (`tokenProvider`).
- Must not hardcode legacy voice lists.
- Keep UI consistent with existing dropdowns.

---

### Task 1: Update Validation and Orchestrator

**Files:**
- Modify: `shared/ttsConfig.js`
- Modify: `electron/tts/ttsJobOrchestrator.js`

**Interfaces:**
- Consumes: The `validateTtsJobRequest` function needs to allow `'legacy'`.
- Produces: The orchestrator handles `mode === 'legacy'` by executing the `cloud-rest` engine.

- [ ] **Step 1: Write the failing tests for config validation**

```javascript
// tests/ttsConfig.test.js
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateTtsJobRequest } from '../shared/ttsConfig.js';

test('validateTtsJobRequest allows legacy mode', () => {
  const result = validateTtsJobRequest({
    text: 'Hello', mode: 'legacy', languageCode: 'en-US',
    speaker: 'A', voiceName: 'en-US-Neural2-A',
    outputPath: 'out.mp3', outputFormat: 'mp3', speakingRate: 1
  });
  assert.equal(result.ok, true);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL (Invalid TTS mode.)

- [ ] **Step 3: Write minimal implementation in `shared/ttsConfig.js`**

Modify `validateTtsJobRequest` to include `'legacy'`:
```javascript
  if (!['stable', 'expressive', 'legacy'].includes(request.mode)) {
    return { ok: false, error: 'Invalid TTS mode.' };
  }
```

- [ ] **Step 4: Update Orchestrator (`electron/tts/ttsJobOrchestrator.js`)**

In `createTtsJobOrchestrator.run`:
```javascript
        if (rawRequest.mode === 'legacy') {
          return await runAttempt('cloud-rest', rawRequest, context);
        }
        if (rawRequest.mode === 'expressive') {
//...
```

- [ ] **Step 5: Run tests to verify pass**
Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -am "feat: add legacy mode validation and orchestrator routing"
```

---

### Task 2: Implement Voice Fetching IPC Backend

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.cjs`
- Modify: `src/electron.d.ts`

**Interfaces:**
- Consumes: `tokenProvider` from `electron/tts/googleCredentials.js`
- Produces: `window.electronAPI.getGoogleTtsVoices()` which returns an array of voice objects.

- [ ] **Step 1: Write the IPC Handler in `electron/main.js`**

Add near the top imports:
```javascript
import { tokenProvider } from './tts/googleCredentials.js';
```

Add inside `main.js` (around other TTS IPC handlers):
```javascript
let cachedVoices = null;

ipcMain.handle('get-google-tts-voices', async () => {
  if (cachedVoices) return cachedVoices;
  try {
    const accessToken = await tokenProvider();
    const response = await fetch('https://texttospeech.googleapis.com/v1/voices', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }
    cachedVoices = data.voices || [];
    return cachedVoices;
  } catch (error) {
    console.error('Failed to fetch TTS voices:', error);
    throw error;
  }
});
```

- [ ] **Step 2: Update preload script (`electron/preload.cjs`)**

Add to the exported API object:
```javascript
  getGoogleTtsVoices: () => ipcRenderer.invoke('get-google-tts-voices'),
```

- [ ] **Step 3: Update TS Definitions (`src/electron.d.ts`)**

Add to `ElectronAPI` interface:
```typescript
  getGoogleTtsVoices: () => Promise<any[]>;
```
Also add `'legacy'` to `TtsMode`:
```typescript
type TtsMode = 'stable' | 'expressive' | 'legacy';
```

- [ ] **Step 4: Commit**
```bash
git commit -am "feat: add IPC handler to fetch Google TTS voices"
```

---

### Task 3: Update React UI

**Files:**
- Modify: `src/components/TtsScreen.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.getGoogleTtsVoices()`

- [ ] **Step 1: Add state variables and effect to fetch voices**

In `TtsScreen.tsx`:
```tsx
  const [legacyVoices, setLegacyVoices] = useState<any[]>([]);
  const [legacyEngine, setLegacyEngine] = useState('Neural2');
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);

  useEffect(() => {
    if (mode === 'legacy' && legacyVoices.length === 0) {
      setIsFetchingVoices(true);
      window.electronAPI.getGoogleTtsVoices()
        .then(setLegacyVoices)
        .catch(err => alert('Failed to fetch voices: ' + err.message))
        .finally(() => setIsFetchingVoices(false));
    }
  }, [mode]);
```

- [ ] **Step 2: Add Legacy to Mode Selector**

Update the Mode radio buttons to include `legacy`:
```tsx
  <label className="flex items-center space-x-2">
    <input
      type="radio"
      checked={mode === 'legacy'}
      onChange={() => setMode('legacy')}
      className="text-blue-500 bg-gray-900 border-gray-700"
    />
    <span>Legacy Cloud</span>
  </label>
```

- [ ] **Step 3: Build the Voice Filtering Logic**

Create derived state for filtered voices:
```tsx
  const availableLegacyVoices = React.useMemo(() => {
    if (mode !== 'legacy') return [];
    return legacyVoices.filter(v => 
      v.languageCodes.includes(langCode) && 
      v.name.includes(legacyEngine)
    );
  }, [legacyVoices, langCode, legacyEngine, mode]);
```

- [ ] **Step 4: Add Dropdowns for Engine and Voice**

Inside the "Voice setup" section, conditionally render the legacy engine & voice selector if `mode === 'legacy'`:
```tsx
{mode === 'legacy' ? (
  <div className="flex gap-2">
    <div className="flex-1">
      <label className="block text-xs font-medium text-gray-400 mb-1">Engine</label>
      <select
        value={legacyEngine}
        onChange={e => setLegacyEngine(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
      >
        <option value="Neural2">Neural2</option>
        <option value="Standard">Standard</option>
        <option value="WaveNet">WaveNet</option>
        <option value="Studio">Studio</option>
        <option value="Polyglot">Polyglot</option>
      </select>
    </div>
    <div className="flex-1">
      <label className="block text-xs font-medium text-gray-400 mb-1">Voice</label>
      <select
        value={voiceName}
        onChange={e => {
          setVoiceName(e.target.value);
          // Just use the voiceName as the speaker name too
        }}
        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
      >
        {isFetchingVoices ? <option>Loading...</option> : null}
        {availableLegacyVoices.map(v => (
          <option key={v.name} value={v.name}>{v.name} ({v.ssmlGender})</option>
        ))}
      </select>
    </div>
  </div>
) : (
  // Existing speaker select code for stable/expressive...
)}
```

- [ ] **Step 5: Verify the Build**
Run: `npm run build`
Expected: Build succeeds without TypeScript errors.

- [ ] **Step 6: Commit**
```bash
git commit -am "feat: add legacy voice selection UI"
```
