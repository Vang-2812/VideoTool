import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFilename } from '../electron/fileParser.js';

describe('parseFilename', () => {
  it('parses 3-part filename without ms correctly', () => {
    const result = parseFilename('scene_01_15_03.png');
    assert.deepEqual(result, {
      mm: 1,
      ss: 15,
      ms: 0,
      index: 3,
      ext: 'png',
      startTime: 75
    });
  });

  it('parses 4-part filename with 3-digit ms correctly', () => {
    const result = parseFilename('scene_01_15_500_03.png');
    assert.deepEqual(result, {
      mm: 1,
      ss: 15,
      ms: 500,
      index: 3,
      ext: 'png',
      startTime: 75.5
    });
  });

  it('parses storyboard_ prefix with ms correctly', () => {
    const result = parseFilename('storyboard_00_02_050_01.jpg');
    assert.deepEqual(result, {
      mm: 0,
      ss: 2,
      ms: 50,
      index: 1,
      ext: 'jpg',
      startTime: 2.05
    });
  });

  it('returns null for invalid filename formats', () => {
    assert.equal(parseFilename('invalid_file.png'), null);
    assert.equal(parseFilename('scene_01_png'), null);
  });
});
