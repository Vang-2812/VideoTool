export const TTS_CHUNK_LIMITS = Object.freeze({
  'chirp-streaming': 1000,
  'cloud-rest': 4500,
  gemini: 3500
});

function utf8Bytes(value) {
  return new TextEncoder().encode(value).length;
}

function normalizeText(value) {
  return value
    .trim()
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function splitAtWhitespace(value, limit) {
  const words = value.match(/\S+\s*/gu) ?? [];
  const parts = [];
  let current = '';

  for (const wordWithSpacing of words) {
    if (utf8Bytes(wordWithSpacing.trimEnd()) > limit) {
      throw new Error('A single token exceeds the provider byte limit.');
    }

    const candidate = current + wordWithSpacing;
    if (utf8Bytes(candidate) <= limit) {
      current = candidate;
    } else {
      if (current) parts.push(current);
      current = wordWithSpacing;
    }
  }

  if (current) parts.push(current);
  return parts;
}

export function chunkTextForTTS(text, rawOptions = {}) {
  if (!text.trim()) return [];

  const options = typeof rawOptions === 'string'
    ? { provider: 'gemini', prompt: rawOptions }
    : rawOptions;
  const provider = options.provider ?? 'gemini';
  const limit = TTS_CHUNK_LIMITS[provider];

  if (!limit) throw new Error(`Unsupported TTS provider: ${provider}`);

  const normalized = normalizeText(text);
  const segmenter = new Intl.Segmenter(options.languageCode ?? 'en-US', {
    granularity: 'sentence'
  });
  const sentences = Array.from(
    segmenter.segment(normalized),
    ({ segment }) => segment
  ).filter(Boolean);
  const units = sentences.flatMap((sentence) => (
    utf8Bytes(sentence) <= limit
      ? [sentence]
      : splitAtWhitespace(sentence, limit)
  ));

  const chunks = [];
  let current = '';

  for (const unit of units) {
    const candidate = current + unit;
    if (utf8Bytes(candidate) <= limit) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = unit;
    }
  }

  if (current) chunks.push(current);

  return chunks.map((chunk, index) => ({
    id: index + 1,
    text: chunk,
    byteCount: utf8Bytes(chunk),
    status: 'pending',
    isHardCut: false
  }));
}
