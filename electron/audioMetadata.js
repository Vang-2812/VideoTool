import { exec } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import util from 'util';

const execAsync = util.promisify(exec);
const ffmpegPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');

/**
 * Reads the duration of an audio (or video) file in seconds.
 * Leverages the static ffmpeg binary to query the file details.
 */
export async function readAudioDuration(filePath) {
  try {
    let duration = 0;
    
    try {
      // ffmpeg -i will exit with code 1 because no output is specified,
      // but it will print metadata (including Duration) to stderr.
      await execAsync(`"${ffmpegPath}" -i "${filePath}"`);
    } catch (err) {
      const output = err.stderr || '';
      const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const centiseconds = parseInt(match[4], 10);
        
        duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }
    }

    if (duration > 0) {
      return { success: true, duration };
    } else {
      return { 
        success: false, 
        error: 'Không thể phân tích thông tin thời lượng từ tệp tin âm thanh.' 
      };
    }
  } catch (err) {
    console.error('Failed to read audio duration:', err);
    return { 
      success: false, 
      error: `Lỗi đọc tệp audio: ${err.message}` 
    };
  }
}
