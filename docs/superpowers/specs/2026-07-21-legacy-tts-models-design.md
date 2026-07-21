# Design Document: Support for Legacy TTS Models

## Overview
Currently, the VideoTool application uses modern Google TTS voices via the `stable` (Chirp) and `expressive` (Gemini) modes. The goal is to add support for Google Cloud's Legacy TTS Models (WaveNet, Studio, Standard, Neural2, and Polyglot) using the exact same standard OAuth authentication method already in place.

## Proposed Changes

### 1. UI Additions (`src/components/TtsScreen.tsx`)
- **New Mode**: Add a third mode "Legacy" (Standard Cloud) alongside "Stable" and "Expressive".
- **Dynamic Voice Fetching**: When "Legacy" is selected, the UI will invoke a new IPC method (`get-google-tts-voices`) to fetch the list of all available voices dynamically from Google.
- **Engine Filter**: Add a dropdown to filter the fetched voices by Engine type (WaveNet, Studio, Standard, Neural2, Polyglot).
- **Voice Selection**: A final dropdown to choose the specific voice instance (e.g., `en-US-Neural2-A`). The UI will handle extracting and displaying the gender and name for user convenience.

### 2. Electron Backend API (`electron/main.js` & `electron/preload.cjs`)
- **New IPC Handler**: `get-google-tts-voices`
  - Fetches the available voices by calling `GET https://texttospeech.googleapis.com/v1/voices`.
  - Re-uses the existing `tokenProvider` in `googleCredentials.js` to get the `Authorization: Bearer <token>` header, ensuring it shares the exact same auth as everything else.
  - Returns a cached list of voices to the renderer to avoid repetitive API calls on every dropdown click.

### 3. TTS Job Orchestration (`electron/tts/ttsJobOrchestrator.js`)
- The Orchestrator will accept the new `legacy` mode. 
- For `legacy` mode, the orchestrator will configure `engine = 'cloud-rest'` and directly pass the selected `voiceName` straight into the `synthesizeGoogleRest` adapter, as the REST API natively supports all legacy voice models.
- **Validation update (`shared/ttsConfig.js`)**: Ensure `legacy` is added to the list of valid TTS modes.

## Error Handling
- If fetching voices fails (due to network or unauthenticated state), the UI will display a gentle toast notification asking the user to check their Google Credentials.

## Testing & Verification
- Verify that users can select "Legacy", filter by "Neural2", and select a Vietnamese or English voice.
- Verify that generating TTS correctly downloads the MP3/WAV file.
- Verify that the API falls back cleanly if the auth token is expired or invalid.
