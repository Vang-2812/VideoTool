import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkTextForTTS } from '../shared/ttsChunker.js';

test('packs Cloud REST chunks below 4500 UTF-8 bytes', () => {
  const text = Array.from({ length: 900 }, (_, i) => `Sentence ${i}.`).join(' ');
  const chunks = chunkTextForTTS(text, { provider: 'cloud-rest', languageCode: 'en-US' });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.byteCount <= 4500));
  assert.equal(chunks.map((chunk) => chunk.text).join(''), text);
});

test('does not split a Unicode word', () => {
  const chunks = chunkTextForTTS('hello '.repeat(900) + 'café', {
    provider: 'gemini',
    languageCode: 'en-US',
    prompt: 'Warm'
  });
  assert.ok(chunks.every((chunk) => !chunk.isHardCut));
  assert.equal(chunks.at(-1).text.endsWith('café'), true);
});

test('rejects one token larger than the provider limit', () => {
  assert.throws(
    () => chunkTextForTTS('x'.repeat(4600), { provider: 'cloud-rest', languageCode: 'en-US' }),
    /single token/i
  );
});

test('preserves paragraph boundaries', () => {
  const text = 'First paragraph.\n\nSecond paragraph.';
  const chunks = chunkTextForTTS(text, { provider: 'chirp-streaming', languageCode: 'en-US' });
  assert.equal(chunks.map((chunk) => chunk.text).join(''), text);
});
