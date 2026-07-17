import test from 'node:test';
import assert from 'node:assert/strict';
import { groupWordsByScriptSentences } from '../shared/scriptSentenceParser.js';

test('Sentence grouping uses script sentences when script is provided', () => {
  const scriptText = "Sentence one is here. Sentence two follows it.";
  const alignedWords = [
    { word: 'Sentence', start: 0.0, end: 0.5 },
    { word: 'one', start: 0.5, end: 0.8 },
    { word: 'is', start: 0.8, end: 1.0 },
    { word: 'here.', start: 1.0, end: 1.5 },
    { word: 'Sentence', start: 1.8, end: 2.2 },
    { word: 'two', start: 2.2, end: 2.5 },
    { word: 'follows', start: 2.5, end: 2.9 },
    { word: 'it.', start: 2.9, end: 3.4 }
  ];

  const result = groupWordsByScriptSentences(alignedWords, scriptText);
  assert.equal(result.length, 2);
  assert.equal(result[0].text, "Sentence one is here.");
  assert.equal(result[0].start, 0.0);
  assert.equal(result[0].end, 1.5);

  assert.equal(result[1].text, "Sentence two follows it.");
  assert.equal(result[1].start, 1.8);
  assert.equal(result[1].end, 3.4);
});
