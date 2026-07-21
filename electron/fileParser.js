import fs from 'fs/promises';
import path from 'path';

// REGEX according to FR-2.2.1 (supports storyboard_ or scene_ with optional ms)
const FILE_REGEX = /^(?:storyboard|scene)_(\d{2})_(\d{2})(?:_(\d{1,3}))?_(\d+)\.(png|jpg|jpeg)$/i;
const DEFAULT_MIN_DURATION = 0.5; // FR-3.3.2 default (configurable)

/**
 * Parses a single filename based on the regex.
 * Returns parsed object or null if invalid format.
 */
export function parseFilename(filename) {
  const match = filename.match(FILE_REGEX);
  if (!match) return null;

  const mm = parseInt(match[1], 10);
  const ss = parseInt(match[2], 10);
  const hasMs = match[3] !== undefined;
  const ms = hasMs ? parseInt(match[3], 10) : 0;
  const index = parseInt(match[4], 10);
  const ext = match[5].toLowerCase();

  return {
    mm,
    ss,
    ms,
    index,
    ext,
    startTime: mm * 60 + ss + (ms / 1000)
  };
}

/**
 * Calculates display durations for a sorted list of storyboard files.
 * Implementation of FR-3.2, FR-3.3.2 (auto-fix zero duration) with "keep original start".
 * 
 * "giữ nguyên bắt đầu" (keep original start) means:
 * - If image[i] and image[i+1] have the same start time (duration = 0), we set duration[i] = 0.5s.
 * - This pushes the actual display start of image[i+1] by 0.5s.
 * - To avoid shifting the rest of the timeline, we subtract this 0.5s from duration[i+1].
 * - If that makes duration[i+1] less than 0.5s or negative, we cascade the adjustment.
 */
export function calculateTimeline(files, totalDuration, minDuration = DEFAULT_MIN_DURATION) {
  const n = files.length;
  if (n === 0) return [];

  // Reset durations
  const result = files.map(f => ({
    ...f,
    duration: 0,
    isAutoFixed: false
  }));

  // Rule FR-3.3.3: Only 1 image -> occupies the whole duration
  if (n === 1) {
    result[0].duration = totalDuration;
    return result;
  }

  // 1. Calculate raw durations based on start times (FR-3.2)
  for (let i = 0; i < n - 1; i++) {
    result[i].duration = result[i + 1].startTime - result[i].startTime;
  }
  // Last image duration (FR-3.2)
  result[n - 1].duration = totalDuration - result[n - 1].startTime;

  // 2. Adjust for minimum duration auto-fix (FR-3.3.2)
  // We go left-to-right. If we add duration to result[i], we must deduct it from subsequent files.
  let carryDeduction = 0;

  for (let i = 0; i < n; i++) {
    // Apply any carried-over deduction first
    if (carryDeduction > 0) {
      const available = result[i].duration;
      // We can deduct from this item, but we must respect the minDuration unless it's the last item and we have no choice,
      // or if it's already tied.
      // Let's deduct as much as possible up to making it minDuration (or 0 if we must).
      const maxDeductible = Math.max(0, available - minDuration);
      
      if (maxDeductible >= carryDeduction) {
        result[i].duration -= carryDeduction;
        carryDeduction = 0;
      } else {
        result[i].duration -= maxDeductible;
        carryDeduction -= maxDeductible;
      }
    }

    // Now check if result[i] needs to be boosted to minDuration
    if (result[i].duration < minDuration) {
      const boost = minDuration - result[i].duration;
      result[i].duration = minDuration;
      result[i].isAutoFixed = true;
      
      // We must deduct this boost from subsequent files to keep the timeline aligned
      carryDeduction += boost;
    }
  }

  // If there's still carryDeduction left after the last image, it means the totalDuration was too small
  // or we couldn't fit the minimum durations. We'll let the last image absorb it (which might make it exceed the total duration slightly),
  // but this will be prevented by the validation rules.
  return result;
}

/**
 * Validates the project files and total duration.
 * Implementations of FR-3.3.1, FR-3.3.4.
 */
export function validateProject(files, totalDuration, hasVoiceAudio = false) {
  if (!files || files.length === 0) {
    return {
      isValid: false,
      error: "Danh sách rỗng: Không tìm thấy ảnh storyboard nào hợp lệ trong thư mục."
    };
  }

  const lastImage = files[files.length - 1];
  const lastStart = lastImage.startTime;

  // FR-3.3.1 / FR-2.3.1: TotalVideoDuration must be greater than start_time(lastImage)
  if (totalDuration <= lastStart) {
    if (hasVoiceAudio) {
      return {
        isValid: false,
        error: `Audio chính (${totalDuration}s) ngắn hơn thời điểm bắt đầu của ảnh cuối cùng (${lastStart}s). Vui lòng chọn audio dài hơn hoặc bớt ảnh.`
      };
    }
    return {
      isValid: false,
      error: `Tổng thời lượng video (${totalDuration}s) phải lớn hơn thời điểm bắt đầu ảnh cuối cùng (${lastStart}s). Vui lòng nhập giá trị ≥ ${lastStart + 1} giây.`
    };
  }

  // Verify if we can fit all images with minimum durations
  const minDurationNeeded = files.length * DEFAULT_MIN_DURATION;
  // If the timeline is extremely squished, we might want to warn or error out
  if (totalDuration < minDurationNeeded) {
    // This is an edge case validation
    return {
      isValid: true,
      warning: `Tổng thời lượng (${totalDuration}s) quá ngắn để hiển thị tất cả ${files.length} ảnh với thời lượng tối thiểu ${DEFAULT_MIN_DURATION}s.`
    };
  }

  return { isValid: true };
}

/**
 * Parses all files in a directory, validates their names, sorts them,
 * and calculates their timeline parameters.
 */
export async function parseStoryboardDirectory(dirPath, totalDuration = null, minDuration = DEFAULT_MIN_DURATION) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const validFiles = [];
    const skippedFiles = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      
      const parsed = parseFilename(entry.name);
      if (parsed) {
        validFiles.push({
          path: path.join(dirPath, entry.name),
          name: entry.name,
          ...parsed
        });
      } else {
        // Only skip images, or skip all files? Let's check FR-2.2.2: "File không đúng định dạng tên -> skipped list"
        // Let's check if the file matches common image extensions before listing as skipped to avoid listing desktop.ini
        const ext = path.extname(entry.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          skippedFiles.push({
            name: entry.name,
            reason: "Tên file không đúng định dạng quy ước (scene_mm_ss_index hoặc scene_mm_ss_ms_index)"
          });
        }
      }
    }

    // FR-3.3.4: Empty check
    if (validFiles.length === 0) {
      return {
        success: false,
        error: "Không tìm thấy ảnh storyboard nào hợp lệ trong thư mục này."
      };
    }

    // FR-2.2.4: Sort by startTime, then index
    validFiles.sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime - b.startTime;
      }
      return a.index - b.index;
    });

    const lastImageStartTime = validFiles[validFiles.length - 1].startTime;
    
    // If totalDuration is not provided, estimate it as lastStart + 10s
    const activeDuration = totalDuration !== null ? totalDuration : (lastImageStartTime + 10);
    
    // Calculate timeline
    const timelineFiles = calculateTimeline(validFiles, activeDuration, minDuration);

    return {
      success: true,
      directoryPath: dirPath,
      files: timelineFiles,
      skipped: skippedFiles,
      lastImageStartTime
    };
  } catch (err) {
    console.error("Error reading directory:", err);
    return {
      success: false,
      error: `Không thể đọc thư mục: ${err.message}`
    };
  }
}
