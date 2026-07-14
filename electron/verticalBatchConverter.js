import path from 'node:path';
import fs from 'node:fs/promises';
import { buildVerticalSegments, buildSegmentFilename, buildSegmentTitle } from '../shared/verticalSegments.js';
import { convertToVertical, cancelVerticalConvert, getVideoDuration } from './verticalConverter.js';

let batchCancelled = false;

export async function convertToVerticalBatch(params, onProgress, dependencies = {}) {
  const probeDuration = dependencies.probeDuration || getVideoDuration;
  const renderSegment = dependencies.renderSegment || convertToVertical;
  const removeFile = dependencies.removeFile || ((filePath) => fs.unlink(filePath).catch(() => {}));
  batchCancelled = false;
  
  try {
    const sourceVideoPath = params.sourceVideoPath || params.inputPath;
    const sourceDuration = await probeDuration(sourceVideoPath);
    const segments = buildVerticalSegments(sourceDuration, params.splitPoints, params.overlapSeconds);
    const totalWork = segments.reduce((sum, segment) => sum + segment.duration, 0);
    const outputPaths = [];
    let completedWork = 0;

    for (const segment of segments) {
      if (batchCancelled) {
        return { success: false, cancelled: true, outputPaths, completedSegments: outputPaths.length, totalSegments: segments.length, error: 'Đã hủy chuyển đổi.' };
      }
      const segmentFilename = buildSegmentFilename(params.outputBaseName, segment.index);
      const outputPath = path.join(params.outputDirectory, segmentFilename);
      const result = await renderSegment({
        ...params,
        outputPath,
        title: buildSegmentTitle(params.title, segment.index),
        startTime: segment.startTime,
        duration: segment.duration,
        splitPoints: undefined,
        overlapSeconds: undefined,
        outputDirectory: undefined,
        outputBaseName: undefined
      }, (current) => onProgress?.({
        ...current,
        progress: Math.min(100, Math.floor(((completedWork + segment.duration * current.progress / 100) / totalWork) * 100)),
        segmentIndex: segment.index,
        segmentCount: segments.length
      }));
      
      if (batchCancelled) {
        await removeFile(outputPath);
        return { success: false, cancelled: true, outputPaths, completedSegments: outputPaths.length, totalSegments: segments.length, error: 'Đã hủy chuyển đổi.' };
      }
      if (!result.success) {
        await removeFile(outputPath);
        return { success: false, outputPaths, completedSegments: outputPaths.length, totalSegments: segments.length, error: `Đoạn ${segment.index}/${segments.length}: ${result.error || 'FFmpeg thất bại.'}` };
      }
      outputPaths.push(outputPath);
      completedWork += segment.duration;
    }
    
    onProgress?.({ progress: 100, eta: '00:00', segmentIndex: segments.length, segmentCount: segments.length });
    return { success: true, outputPaths, completedSegments: segments.length, totalSegments: segments.length };
  } catch (err) {
    console.error('Batch vertical convert error:', err);
    return { success: false, outputPaths: [], completedSegments: 0, totalSegments: 0, error: err.message };
  }
}

export function cancelVerticalBatch() {
  batchCancelled = true;
  return cancelVerticalConvert();
}
