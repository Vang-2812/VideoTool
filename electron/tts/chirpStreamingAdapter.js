import textToSpeech from '@google-cloud/text-to-speech';
import { once } from 'node:events';

function abortError() {
  return Object.assign(new Error('TTS job cancelled.'), {
    name: 'AbortError'
  });
}

async function writeFrame(stream, frame) {
  if (!stream.write(frame)) await once(stream, 'drain');
}

export function createChirpClient(credentials) {
  return new textToSpeech.v1.TextToSpeechClient({ credentials });
}

export async function synthesizeChirpStreaming(options) {
  if (options.signal?.aborted) throw abortError();

  const client = options.createClient
    ? options.createClient(options.credentials)
    : createChirpClient(options.credentials);
  const stream = client.streamingSynthesize();
  let audioWrites = Promise.resolve();

  const done = new Promise((resolve, reject) => {
    stream.on('data', ({ audioContent }) => {
      if (audioContent?.length) {
        const copy = Buffer.from(audioContent);
        audioWrites = audioWrites.then(() => options.sink.append(copy));
      }
    });
    stream.once('end', () => audioWrites.then(resolve, reject));
    stream.once('error', reject);
  });
  // Cancellation can reject both a pending `once(stream, 'drain')` and this
  // completion promise. Observe completion immediately so the second rejection
  // cannot escape when the write path is the one propagated to the caller.
  void done.catch(() => {});

  const abort = () => stream.cancel?.();
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    await writeFrame(stream, {
      streamingConfig: {
        voice: {
          languageCode: options.languageCode,
          name: options.voiceName
        },
        streamingAudioConfig: {
          audioEncoding: 'PCM',
          sampleRateHertz: 24000,
          speakingRate: options.speakingRate
        }
      }
    });

    for (let index = 0; index < options.chunks.length; index += 1) {
      if (options.signal?.aborted) throw abortError();
      await writeFrame(stream, {
        input: { text: options.chunks[index].text }
      });
      options.onProgress?.({
        phase: 'streaming',
        progress: Math.round((index + 1) / options.chunks.length * 90),
        engine: 'chirp-streaming'
      });
    }

    stream.end();
    await done;
  } catch (error) {
    if (options.signal?.aborted && error?.name !== 'AbortError') {
      throw abortError();
    }
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await client.close?.();
  }
}
