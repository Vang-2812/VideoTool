import test from 'node:test';
import assert from 'node:assert/strict';
import { createPcmWavHeader } from '../electron/tts/wav.js';
import {
  buildRestPayload,
  synthesizeGoogleRest
} from '../electron/tts/googleRestAdapter.js';

function wavAudioContent(pcm) {
  return Buffer.concat([
    createPcmWavHeader(pcm.length),
    pcm
  ]).toString('base64');
}

test('builds Chirp payload without Gemini prompt or modelName', () => {
  const payload = buildRestPayload({
    engine: 'chirp-rest',
    text: 'Hello',
    languageCode: 'en-US',
    voiceName: 'en-US-Chirp3-HD-Charon',
    speakingRate: 1
  });
  assert.equal(payload.voice.name, 'en-US-Chirp3-HD-Charon');
  assert.equal('modelName' in payload.voice, false);
  assert.equal('prompt' in payload.input, false);
  assert.equal(payload.audioConfig.audioEncoding, 'LINEAR16');
});

test('builds Gemini payload with prompt and modelName', () => {
  const payload = buildRestPayload({
    engine: 'gemini-rest',
    text: 'Hello',
    prompt: 'Warm',
    modelName: 'gemini-3.1-flash-tts-preview',
    languageCode: 'en-US',
    voiceName: 'Charon',
    speakingRate: 1
  });
  assert.equal(payload.voice.modelName, 'gemini-3.1-flash-tts-preview');
  assert.equal(payload.input.prompt, 'Warm');
});

test('strips each REST WAV container before appending ordered PCM', async () => {
  const appended = [];
  const responses = [Buffer.from([1, 0]), Buffer.from([2, 0])];
  let responseIndex = 0;
  const progress = [];

  await synthesizeGoogleRest({
    chunks: [{ text: 'Hello.' }, { text: 'World.' }],
    engine: 'chirp-rest',
    languageCode: 'en-US',
    voiceName: 'en-US-Chirp3-HD-Charon',
    speakingRate: 1,
    tokenProvider: async () => 'token',
    sink: { append: async (value) => appended.push(value) },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        audioContent: wavAudioContent(responses[responseIndex++])
      })
    }),
    onProgress: (value) => progress.push(value)
  });

  assert.deepEqual(Buffer.concat(appended), Buffer.from([1, 0, 2, 0]));
  assert.deepEqual(progress.map(({ progress: value }) => value), [50, 100]);
});

test('retries HTTP 429 and honors Retry-After', async () => {
  const pcm = Buffer.from([1, 0]);
  let calls = 0;
  const delays = [];

  await synthesizeGoogleRest({
    chunks: [{ text: 'Hello' }],
    engine: 'chirp-rest',
    languageCode: 'en-US',
    voiceName: 'en-US-Chirp3-HD-Charon',
    speakingRate: 1,
    tokenProvider: async () => 'token',
    sink: { append: async () => {} },
    fetchImpl: async () => ++calls === 1
      ? {
          ok: false,
          status: 429,
          headers: { get: () => '2' },
          json: async () => ({ error: { message: 'rate limited' } })
        }
      : {
          ok: true,
          json: async () => ({ audioContent: wavAudioContent(pcm) })
        },
    sleep: async (milliseconds) => delays.push(milliseconds),
    onProgress: () => {}
  });

  assert.equal(calls, 2);
  assert.deepEqual(delays, [2000]);
});

test('does not retry permanent HTTP errors', async () => {
  let calls = 0;
  await assert.rejects(() => synthesizeGoogleRest({
    chunks: [{ text: 'Hello' }],
    engine: 'chirp-rest',
    languageCode: 'en-US',
    voiceName: 'en-US-Chirp3-HD-Charon',
    speakingRate: 1,
    tokenProvider: async () => 'token',
    sink: { append: async () => {} },
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: async () => ({ error: { message: 'bad request' } })
      };
    },
    sleep: async () => {},
    onProgress: () => {}
  }), /bad request/);
  assert.equal(calls, 1);
});
