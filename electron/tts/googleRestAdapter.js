import { extractPcmFromWav } from './wav.js';
import { withRetry } from './retry.js';

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export function buildRestPayload(options) {
  const payload = {
    input: { text: options.text },
    voice: {
      languageCode: options.languageCode,
      name: options.voiceName
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 24000,
      speakingRate: options.speakingRate
    }
  };

  if (options.engine === 'gemini-rest') {
    payload.voice.modelName = options.modelName;
    if (options.prompt?.trim()) {
      payload.input.prompt = options.prompt.trim();
    }
  }

  return payload;
}

function parseRetryAfter(response) {
  const value = response.headers?.get?.('retry-after');
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export async function synthesizeGoogleRest(options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await options.tokenProvider();

  for (let index = 0; index < options.chunks.length; index += 1) {
    const chunk = options.chunks[index];
    const wavBuffer = await withRetry(async () => {
      const response = await fetchImpl(GOOGLE_TTS_URL, {
        method: 'POST',
        signal: options.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(buildRestPayload({
          ...options,
          text: chunk.text
        }))
      });
      const data = await response.json();

      if (!response.ok) {
        throw Object.assign(
          new Error(data.error?.message ?? `HTTP ${response.status}`),
          {
            status: response.status,
            retryAfterMs: parseRetryAfter(response)
          }
        );
      }
      if (!data.audioContent) {
        throw new Error('Google response did not contain audioContent.');
      }

      return Buffer.from(data.audioContent, 'base64');
    }, {
      attempts: 3,
      signal: options.signal,
      sleep: options.sleep,
      random: options.random
    });

    await options.sink.append(extractPcmFromWav(wavBuffer));
    options.onProgress?.({
      phase: 'synthesizing',
      progress: Math.round((index + 1) / options.chunks.length * 100),
      engine: options.engine
    });
  }
}
