import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScriptSentences, groupWordsByScriptSentences } from '../shared/scriptSentenceParser.js';

test('parseScriptSentences splits by punctuation and newlines correctly', () => {
  const script = "The river is gone. The mud is cracking!\nYour tongue feels too large.";
  const sentences = parseScriptSentences(script);
  assert.equal(sentences.length, 3);
  assert.equal(sentences[0].text, "The river is gone.");
  assert.equal(sentences[1].text, "The mud is cracking!");
  assert.equal(sentences[2].text, "Your tongue feels too large.");
});

test('groupWordsByScriptSentences maps aligned word timestamps to script sentences', () => {
  const script = "The river is gone. The mud is cracking!";
  const alignedWords = [
    { word: 'The', start: 0.1, end: 0.3 },
    { word: 'river', start: 0.3, end: 0.6 },
    { word: 'is', start: 0.6, end: 0.8 },
    { word: 'gone.', start: 0.8, end: 1.2 },
    { word: 'The', start: 1.5, end: 1.7 },
    { word: 'mud', start: 1.7, end: 2.0 },
    { word: 'is', start: 2.0, end: 2.2 },
    { word: 'cracking!', start: 2.2, end: 2.8 }
  ];

  const result = groupWordsByScriptSentences(alignedWords, script);
  assert.equal(result.length, 2);
  assert.equal(result[0].text, "The river is gone.");
  assert.equal(result[0].start, 0.1);
  assert.equal(result[0].end, 1.2);

  assert.equal(result[1].text, "The mud is cracking!");
  assert.equal(result[1].start, 1.5);
  assert.equal(result[1].end, 2.8);
});

test('parseScriptSentences splits by extended punctuation when enabled', () => {
  const script = 'Xin chào, tôi là AI! "Đây là ví dụ," anh nói.';
  const sentences = parseScriptSentences(script, { splitExtendedPunctuation: true });

  assert.equal(sentences.length, 4);
  assert.equal(sentences[0].text, 'Xin chào,');
  assert.equal(sentences[1].text, 'tôi là AI!');
  assert.equal(sentences[2].text, 'Đây là ví dụ,');
  assert.equal(sentences[3].text, 'anh nói.');
});

