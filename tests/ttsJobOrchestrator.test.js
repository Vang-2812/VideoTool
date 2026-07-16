import test from 'node:test';
import assert from 'node:assert/strict';
import { createTtsJobOrchestrator } from '../electron/tts/ttsJobOrchestrator.js';

const request = {
  mode: 'stable',
  text: 'One. Two.',
  languageCode: 'en-US',
  speaker: 'Charon',
  voiceName: 'en-US-Chirp3-HD-Charon',
  speakingRate: 1,
  outputPath: 'C:/tmp/out.mp3',
  outputFormat: 'mp3'
};

function context(signal = new AbortController().signal) {
  return { signal, onProgress: () => {} };
}

test('restarts from zero through streaming, Chirp REST, then Neural2', async () => {
  const calls = [];
  const attempts = [];
  const orchestrator = createTtsJobOrchestrator({
    hasStreamingCredentials: async () => true,
    createAttempt: async (engine) => {
      attempts.push(engine);
      return {
        sink: { append: async () => {} },
        pcmPath: `${engine}-${attempts.length}.pcm`,
        close: async () => calls.push(`close:${engine}`),
        remove: async () => calls.push(`remove:${engine}`)
      };
    },
    stream: async () => {
      calls.push('stream');
      throw new Error('stream failed');
    },
    rest: async ({ engine }) => {
      calls.push(engine);
      if (engine === 'chirp-rest') throw new Error('chirp failed');
    },
    finalize: async ({ engine }) => calls.push(`finalize:${engine}`),
    redactError: (error) => error.message
  });

  const result = await orchestrator.run(request, context());

  assert.deepEqual(attempts, [
    'chirp-streaming',
    'chirp-streaming',
    'chirp-rest',
    'neural2-rest'
  ]);
  assert.equal(result.success, true);
  assert.equal(result.engine, 'neural2-rest');
  assert.equal(result.voiceName, 'en-US-Neural2-D');
  assert.equal(calls.includes('finalize:chirp-rest'), false);
  assert.equal(calls.filter((call) => call.startsWith('remove:')).length, 4);
  assert.equal(calls.at(-1), 'remove:neural2-rest');
});

test('Expressive never falls back to a Stable voice', async () => {
  const engines = [];
  const orchestrator = createTtsJobOrchestrator({
    hasStreamingCredentials: async () => true,
    createAttempt: async (engine) => ({
      sink: { append: async () => {} },
      pcmPath: `${engine}.pcm`,
      close: async () => {},
      remove: async () => {}
    }),
    rest: async ({ engine }) => engines.push(engine),
    finalize: async () => {},
    redactError: (error) => error.message
  });

  const result = await orchestrator.run({
    ...request,
    mode: 'expressive',
    modelName: 'gemini-3.1-flash-tts-preview',
    voiceName: 'Charon',
    prompt: 'Warm'
  }, context());

  assert.equal(result.success, true);
  assert.deepEqual(engines, ['gemini-rest']);
  assert.equal(result.engine, 'gemini-rest');
  assert.equal(result.voiceName, 'Charon');
});

test('returns a cancelled result and never starts fallback after abort', async () => {
  const engines = [];
  const controller = new AbortController();
  const orchestrator = createTtsJobOrchestrator({
    hasStreamingCredentials: async () => true,
    createAttempt: async (engine) => ({
      sink: { append: async () => {} },
      pcmPath: `${engine}.pcm`,
      close: async () => {},
      remove: async () => {}
    }),
    stream: async () => {
      engines.push('chirp-streaming');
      controller.abort();
      throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    },
    rest: async ({ engine }) => engines.push(engine),
    finalize: async () => {},
    redactError: (error) => error.message
  });

  const result = await orchestrator.run(request, context(controller.signal));

  assert.deepEqual(result, {
    success: false,
    cancelled: true,
    error: 'TTS job cancelled.'
  });
  assert.deepEqual(engines, ['chirp-streaming']);
});
