import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { synthesizeChirpStreaming } from '../electron/tts/chirpStreamingAdapter.js';

class FakeBidiStream extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
    this.cancelled = false;
  }

  write(value) {
    this.writes.push(value);
    return true;
  }

  end() {
    queueMicrotask(() => {
      this.emit('data', { audioContent: Buffer.from([1, 0]) });
      this.emit('data', { audioContent: Buffer.from([2, 0]) });
      this.emit('end');
    });
  }

  cancel() {
    this.cancelled = true;
    this.emit('error', Object.assign(new Error('cancelled'), {
      name: 'AbortError'
    }));
  }
}

function baseOptions(stream, overrides = {}) {
  return {
    chunks: [{ text: 'Hello. ' }, { text: 'World.' }],
    languageCode: 'en-US',
    voiceName: 'en-US-Chirp3-HD-Charon',
    speakingRate: 1,
    credentials: { project_id: 'project-one' },
    signal: new AbortController().signal,
    createClient: () => ({
      streamingSynthesize: () => stream,
      close: async () => {}
    }),
    onProgress: () => {},
    ...overrides
  };
}

test('writes one config frame then ordered text frames and PCM', async () => {
  const stream = new FakeBidiStream();
  const parts = [];
  let closed = false;

  await synthesizeChirpStreaming(baseOptions(stream, {
    sink: {
      append: async (value) => {
        await Promise.resolve();
        parts.push(value);
      }
    },
    createClient: () => ({
      streamingSynthesize: () => stream,
      close: async () => { closed = true; }
    })
  }));

  assert.equal(
    stream.writes[0].streamingConfig.voice.name,
    'en-US-Chirp3-HD-Charon'
  );
  assert.equal(
    stream.writes[0].streamingConfig.streamingAudioConfig.audioEncoding,
    'PCM'
  );
  assert.deepEqual(stream.writes.slice(1), [
    { input: { text: 'Hello. ' } },
    { input: { text: 'World.' } }
  ]);
  assert.deepEqual(Buffer.concat(parts), Buffer.from([1, 0, 2, 0]));
  assert.equal(closed, true);
});

test('waits for request-stream backpressure before writing the next frame', async () => {
  const stream = new FakeBidiStream();
  let drained = false;
  stream.write = function write(value) {
    this.writes.push(value);
    if (this.writes.length === 2) {
      queueMicrotask(() => {
        drained = true;
        this.emit('drain');
      });
      return false;
    }
    if (this.writes.length === 3 && !drained) {
      throw new Error('wrote before drain');
    }
    return true;
  };

  await synthesizeChirpStreaming(baseOptions(stream, {
    sink: { append: async () => {} }
  }));
  assert.equal(drained, true);
  assert.equal(stream.writes.length, 3);
});

test('cancels the active bidi stream', async () => {
  const stream = new FakeBidiStream();
  stream.end = () => {};
  const controller = new AbortController();
  const promise = synthesizeChirpStreaming(baseOptions(stream, {
    signal: controller.signal,
    sink: { append: async () => {} }
  }));

  queueMicrotask(() => controller.abort());
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(stream.cancelled, true);
});
