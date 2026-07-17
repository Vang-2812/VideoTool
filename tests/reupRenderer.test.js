import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReupFFmpegArgs } from '../electron/reupRenderer.js';

test('buildReupFFmpegArgs constructs boxblur, vignette, and hflip filtergraph correctly', () => {
  const args = buildReupFFmpegArgs({
    videoPath: 'input.mp4',
    blurMask: { x: 10, y: 80, w: 80, h: 15 },
    enableVignette: true,
    enableFlip: true,
    enableZoom: true,
    voiceoverAudioPath: 'voice.wav',
    bgmAudioPath: 'bgm.mp3',
    bgmVolume: 0.3,
    outputPath: 'output.mp4'
  });

  const argsStr = args.join(' ');
  assert.match(argsStr, /boxblur/);
  assert.match(argsStr, /vignette/);
  assert.match(argsStr, /hflip/);
  assert.match(argsStr, /amix/);
  assert.match(argsStr, /output\.mp4/);
});
