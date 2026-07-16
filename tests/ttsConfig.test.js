import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTtsSettings,
  migrateTtsProfile,
  buildChirpVoiceName,
  resolveNeural2Voice,
  validateTtsJobRequest
} from '../shared/ttsConfig.js';

test('migrates old settings to Stable without losing Gemini fields', () => {
  assert.deepEqual(normalizeTtsSettings({ model: 'gemini-2.5-pro-tts', prompt: 'Warm' }), {
    mode: 'stable',
    languageCode: 'en-US',
    speaker: 'Charon',
    speakingRate: 1,
    outputFormat: 'mp3',
    model: 'gemini-2.5-pro-tts',
    prompt: 'Warm'
  });
  assert.equal(migrateTtsProfile({ id: 'p1', model: 'gemini-2.5-pro-tts' }).mode, 'expressive');
});

test('builds Stable and fallback voice names', () => {
  assert.equal(buildChirpVoiceName('en-US', 'Charon'), 'en-US-Chirp3-HD-Charon');
  assert.equal(resolveNeural2Voice('en-US', 'Charon'), 'en-US-Neural2-D');
  assert.equal(resolveNeural2Voice('en-US', 'Aoede'), 'en-US-Neural2-F');
});

test('validates Gemini prompt byte budget independently', () => {
  const result = validateTtsJobRequest({
    mode: 'expressive',
    text: 'hello',
    prompt: 'x'.repeat(4000),
    languageCode: 'en-US',
    speaker: 'Charon',
    voiceName: 'Charon',
    modelName: 'gemini-3.1-flash-tts-preview',
    speakingRate: 1,
    outputPath: 'C:/tmp/out.mp3',
    outputFormat: 'mp3'
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /prompt/i);
});

test('accepts a complete Stable job request', () => {
  assert.deepEqual(validateTtsJobRequest({
    mode: 'stable',
    text: 'Hello.',
    languageCode: 'en-US',
    speaker: 'Charon',
    voiceName: 'en-US-Chirp3-HD-Charon',
    speakingRate: 1,
    outputPath: 'C:/tmp/voice.mp3',
    outputFormat: 'mp3'
  }), { ok: true });
});

test('rejects an incomplete Expressive IPC request before calling Google', () => {
  const result = validateTtsJobRequest({
    mode: 'expressive',
    text: 'Hello.',
    prompt: 'Warm',
    languageCode: 'en-US',
    speaker: 'Charon',
    voiceName: '',
    speakingRate: 1,
    outputPath: 'C:/tmp/voice.mp3',
    outputFormat: 'mp3'
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /model|voice/i);
});
