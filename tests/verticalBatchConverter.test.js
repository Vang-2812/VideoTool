import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToVerticalBatch } from '../electron/verticalBatchConverter.js';

test('renders segments sequentially with numbered titles and weighted progress', async () => {
  const calls = [];
  const progress = [];
  const result = await convertToVerticalBatch({
    sourceVideoPath: 'C:/media/video.mp4',
    outputDirectory: 'C:/out',
    outputBaseName: 'video.mp4',
    title: 'Title',
    splitPoints: [120, 180],
    overlapSeconds: 5
  }, (event) => progress.push(event), {
    probeDuration: async () => 300,
    renderSegment: async (params, onSegmentProgress) => {
      calls.push(params);
      onSegmentProgress({ progress: 100, eta: '00:00' });
      return { success: true };
    },
    removeFile: async () => {}
  });
  assert.equal(result.success, true);
  assert.deepEqual(calls.map((call) => [call.startTime, call.duration, call.title]), [
    [0, 120, 'Title (1)'], [115, 65, 'Title (2)'], [175, 125, 'Title (3)']
  ]);
  assert.equal(result.outputPaths.at(-1), 'C:\\out\\video_vertical_3.mp4');
  assert.deepEqual(progress.slice(0, 3).map((event) => event.progress), [38, 59, 100]);
  assert.equal(progress.at(-1).progress, 100);
});
