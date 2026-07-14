import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { convertSrtToAss } from './verticalSubtitles.js';

const ffmpegPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');

let activeFfmpegProcess = null;

/**
 * Helper to escape file paths for FFmpeg filter graphs
 */
function escapeFFmpegPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:');
}

/**
 * Read dimensions of a video file
 */
async function getVideoDimensions(filePath) {
  try {
    const output = await new Promise((resolve) => {
      exec(`"${ffmpegPath}" -i "${filePath}"`, (err, stdout, stderr) => {
        resolve(err?.stderr || stderr || stdout || '');
      });
    });
    const match = output.match(/Stream #.*Video:.* (\d+)x(\d+)/);
    if (match) {
      return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10)
      };
    }
  } catch (e) {
    console.error('Failed to parse video dimensions:', e);
  }
  return { width: 1920, height: 1080 }; // Default fallback
}

/**
 * Read duration of a video file in seconds
 */
export async function getVideoDuration(filePath) {
  try {
    const output = await new Promise((resolve) => {
      exec(`"${ffmpegPath}" -i "${filePath}"`, (err, stdout, stderr) => {
        resolve(err?.stderr || stderr || stdout || '');
      });
    });
    const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const ms = parseInt(match[4], 10);
      return hours * 3600 + minutes * 60 + seconds + ms / 100;
    }
  } catch (e) {
    console.error('Failed to parse video duration:', e);
  }
  return 0;
}

/**
 * Helper to dynamically check Windows font file paths
 */
async function getFontPath() {
  const paths = [
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/Arial.ttf',
    '/Windows/Fonts/arial.ttf'
  ];
  for (const p of paths) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  return 'Arial';
}

/**
 * Word wraps title into maximum 2 lines of roughly equal length
 */
function wrapTitle(text, maxLineChars = 24) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let currentLine = [];
  
  for (const word of words) {
    const testLine = [...currentLine, word].join(' ');
    if (testLine.length > maxLineChars && currentLine.length > 0) {
      lines.push(currentLine.join(' '));
      currentLine = [word];
    } else {
      currentLine.push(word);
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  // If we have more than 2 lines, merge the rest into the second line
  if (lines.length > 2) {
    const firstLine = lines[0];
    const secondLine = lines.slice(1).join(' ');
    return [firstLine, secondLine];
  }

  return lines;
}

/**
 * Main function to convert a horizontal video to a vertical 9:16 video
 */
export async function convertToVertical({ inputPath, sourceVideoPath, outputPath, title, srtPath, qualityPreset, titleFontSize = 48, subtitleFontSize = 54, titleColor = '#FFFFFF', subtitleColor = '#FFFF00', titleYPercent = 7.5, subtitleMarginV = 180, startTime, duration }, onProgress) {
  const finalInputPath = inputPath || sourceVideoPath;
  if (!finalInputPath) {
    return { success: false, error: 'Không tìm thấy đường dẫn video gốc.' };
  }

  const tempFiles = [];

  try {
    if (onProgress) {
      onProgress({ progress: 0, eta: 'Đang phân tích video...' });
    }

    // 1. Determine canvas resolution based on qualityPreset
    let w_canvas = 1080;
    let h_canvas = 1920;
    let bitrate = '6000k';

    if (qualityPreset === 'draft') {
      w_canvas = 720;
      h_canvas = 1280;
      bitrate = '2500k';
    } else if (qualityPreset === '4k') {
      w_canvas = 2160;
      h_canvas = 3840;
      bitrate = '35000k';
    } else if (qualityPreset === 'high') {
      bitrate = '12000k';
    }

    // 2. Read dimensions and duration of input video
    const { width: W_in, height: H_in } = await getVideoDimensions(finalInputPath);
    const totalDuration = await getVideoDuration(finalInputPath);
    const activeDuration = Number.isFinite(duration) ? duration : totalDuration;
    
    // 3. Compute dimensions for background (cover fit)
    const scaleBg = Math.max(w_canvas / W_in, h_canvas / H_in);
    const W_bg = Math.floor((W_in * scaleBg) / 2) * 2;
    const H_bg = Math.floor((H_in * scaleBg) / 2) * 2;

    // 4. Compute dimensions for foreground video (fit width, capped at 70% height)
    let W_fg = w_canvas;
    let H_fg = Math.floor((w_canvas * H_in / W_in) / 2) * 2;
    const maxFgHeight = Math.floor((0.7 * h_canvas) / 2) * 2;

    if (H_fg > maxFgHeight) {
      H_fg = maxFgHeight;
      W_fg = Math.floor((maxFgHeight * W_in / H_in) / 2) * 2;
    }

    // 5. Build filter graph
    let filterGraph = `[0:v]scale=${W_bg}:${H_bg},crop=${w_canvas}:${h_canvas},boxblur=20:5,drawbox=color=black@0.3:t=fill[bg];`;
    filterGraph += `[0:v]scale=${W_fg}:${H_fg}[fg];`;
    filterGraph += `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`;

    let lastLabel = '[base]';

    // 6. Add title lines if provided
    if (title && title.trim()) {
      const titleLines = wrapTitle(title.trim(), 20);
      const fontPath = await getFontPath();
      const tempDir = path.dirname(outputPath);

      for (let i = 0; i < titleLines.length; i++) {
        const lineText = titleLines[i];
        const tempTxtPath = path.join(tempDir, `v_title_line_${i}_${Date.now()}.txt`);
        await fs.writeFile(tempTxtPath, lineText, 'utf-8');
        tempFiles.push(tempTxtPath);

        const lineLabel = `[title_l${i}]`;
        
        // Calculate vertical position (Top region center based on titleYPercent)
        const yCenter = Math.round(h_canvas * (titleYPercent / 100));
        const yExpr = titleLines.length === 1
          ? `${yCenter}-text_h/2`
          : (i === 0 ? `${yCenter}-text_h-4` : `${yCenter}+4`);

        const escapedFont = escapeFFmpegPath(fontPath);
        const escapedTextFile = escapeFFmpegPath(tempTxtPath);

        filterGraph += `;${lastLabel}drawtext=fontfile='${escapedFont}':textfile='${escapedTextFile}':fontcolor=${titleColor}:fontsize=${titleFontSize}:x=(w-text_w)/2:y=${yExpr}:shadowcolor=black:shadowx=2:shadowy=2${lineLabel}`;
        lastLabel = lineLabel;
      }
    }

    const isSegment = Number.isFinite(startTime) && Number.isFinite(duration);

    // 7. Add subtitles if SRT is provided
    if (srtPath) {
      try {
        await fs.access(srtPath);
        const tempAssPath = srtPath.replace(/\.srt$/i, `_vertical_${Date.now()}.ass`);
        await convertSrtToAss({
          srtPath,
          assPath: tempAssPath,
          subtitleFontSize,
          subtitleColor,
          subtitleMarginV,
          startTime,
          endTime: isSegment ? startTime + duration : undefined
        });
        tempFiles.push(tempAssPath);

        const escapedAss = escapeFFmpegPath(tempAssPath);
        filterGraph += `;${lastLabel}subtitles='${escapedAss}'[out_v]`;
        lastLabel = '[out_v]';
      } catch (error) {
        if (isSegment) throw new Error(`Không thể xử lý phụ đề cho đoạn video: ${error.message}`);
        console.error('Subtitle file not accessible, skipping burn:', error);
      }
    }

    // 8. Execute FFmpeg command using spawn
    const args = ['-y'];
    if (isSegment) args.push('-ss', String(startTime));
    args.push('-i', finalInputPath);
    if (isSegment) args.push('-t', String(duration));
    args.push(
      '-filter_complex', filterGraph,
      '-map', lastLabel,
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-b:v', bitrate,
      '-pix_fmt', 'yuv420p',
      '-c:a', isSegment ? 'aac' : 'copy',
      ...(isSegment ? ['-b:a', '192k'] : []),
      outputPath
    );

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      activeFfmpegProcess = proc;
      let buffer = '';

      proc.stderr.on('data', (data) => {
        const str = data.toString();
        buffer += str;
        const lines = buffer.split('\r');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (timeMatch && activeDuration > 0) {
            const hh = parseInt(timeMatch[1], 10);
            const mm = parseInt(timeMatch[2], 10);
            const ss = parseInt(timeMatch[3], 10);
            const ms = parseInt(timeMatch[4], 10);
            const currentTime = hh * 3600 + mm * 60 + ss + ms / 100;
            const progress = Math.min(99, Math.floor((currentTime / activeDuration) * 100));

            const speedMatch = line.match(/speed=\s*([\d\.]+)x/);
            let eta = '--:--';
            if (speedMatch && parseFloat(speedMatch[1]) > 0) {
              const speed = parseFloat(speedMatch[1]);
              const secondsRemaining = (activeDuration - currentTime) / speed;
              if (secondsRemaining > 0) {
                const m = Math.floor(secondsRemaining / 60);
                const s = Math.floor(secondsRemaining % 60);
                eta = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
              } else {
                eta = '00:00';
              }
            }

            if (onProgress) {
              onProgress({ progress, eta });
            }
          }
        }
      });

      proc.on('close', (code) => {
        activeFfmpegProcess = null;
        if (code === 0) {
          if (onProgress) {
            onProgress({ progress: 100, eta: '00:00' });
          }
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        activeFfmpegProcess = null;
        reject(err);
      });
    });

    return { success: true };
  } catch (err) {
    console.error('Convert video to vertical error:', err);
    return { success: false, error: err.message };
  } finally {
    activeFfmpegProcess = null;
    // Cleanup temporary files
    for (const f of tempFiles) {
      await fs.unlink(f).catch(() => {});
    }
  }
}

/**
 * Cancels active vertical convert FFmpeg process
 */
export function cancelVerticalConvert() {
  if (activeFfmpegProcess) {
    try {
      activeFfmpegProcess.kill('SIGKILL');
      activeFfmpegProcess = null;
      return true;
    } catch (e) {
      console.error('Failed to kill vertical convert process:', e);
    }
  }
  return false;
}
