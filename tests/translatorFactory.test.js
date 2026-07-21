import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeepSeekPayload, buildTranslationPrompt } from '../electron/translators/translatorFactory.js';

test('buildTranslationPrompt generates structured prompt for translation', () => {
  const segments = [{ id: 1, text: 'Hello world' }];
  const prompt = buildTranslationPrompt(segments, 'English', 'Vietnamese');
  assert.match(prompt, /English/);
  assert.match(prompt, /Vietnamese/);
  assert.match(prompt, /Hello world/);
});

test('buildDeepSeekPayload formats request payload for DeepSeek API', () => {
  const payload = buildDeepSeekPayload('Translate prompt', 'deepseek-chat');
  assert.equal(payload.model, 'deepseek-chat');
  assert.equal(payload.messages[1].content, 'Translate prompt');
});
