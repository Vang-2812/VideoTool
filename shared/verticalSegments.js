export function parseTimestamp(value) {
  const parts = String(value).trim().split(':');
  if (parts.length !== 2 && parts.length !== 3) return { ok: false, error: 'Dùng định dạng MM:SS hoặc HH:MM:SS.' };
  if (parts.some((part) => !/^\d+$/.test(part))) return { ok: false, error: 'Mốc thời gian chỉ được chứa chữ số và dấu hai chấm.' };
  const nums = parts.map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) return { ok: false, error: 'Phút hoặc giây nằm ngoài phạm vi 00–59.' };
  return { ok: true, seconds: hours * 3600 + minutes * 60 + seconds };
}

export function formatTimestamp(value) {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function validateSplitPointInputs(inputs, duration) {
  const parsed = inputs.map(parseTimestamp);
  const counts = new Map();
  for (const result of parsed) if (result.ok) counts.set(result.seconds, (counts.get(result.seconds) || 0) + 1);
  const errors = parsed.map((result) => {
    if (!result.ok) return result.error;
    if (result.seconds <= 0) return 'Mốc phải lớn hơn 00:00.';
    if (!Number.isFinite(duration) || duration <= 0) return 'Chưa đọc được thời lượng video.';
    if (result.seconds >= duration) return 'Mốc phải nhỏ hơn thời lượng video.';
    if (counts.get(result.seconds) > 1) return 'Mốc thời gian bị trùng.';
    return null;
  });
  return {
    valid: inputs.length > 0 && errors.every((error) => error === null),
    splitPoints: parsed.filter((result, index) => result.ok && errors[index] === null).map((result) => result.seconds).sort((a, b) => a - b),
    errors
  };
}

export function buildVerticalSegments(duration, splitPoints, overlapSeconds) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Thời lượng video không hợp lệ.');
  if (!Number.isInteger(overlapSeconds) || overlapSeconds < 0 || overlapSeconds > 30) throw new Error('Overlap phải là số nguyên từ 0 đến 30.');
  const points = [...splitPoints].sort((a, b) => a - b);
  if (points.length === 0 || points.some((point, index) => point <= 0 || point >= duration || (index > 0 && point === points[index - 1]))) {
    throw new Error('Danh sách mốc chia không hợp lệ.');
  }
  const ends = [...points, duration];
  return ends.map((endTime, index) => {
    const startTime = index === 0 ? 0 : Math.max(0, points[index - 1] - overlapSeconds);
    if (endTime <= startTime) throw new Error(`Đoạn ${index + 1} không có thời lượng dương.`);
    return { index: index + 1, startTime, endTime, duration: endTime - startTime };
  });
}

export function buildSegmentTitle(title, index) {
  const trimmed = String(title || '').trim();
  return trimmed ? `${trimmed} (${index})` : '';
}

export function buildSegmentFilename(baseName, index) {
  const fileName = String(baseName || 'video.mp4').split(/[\\/]/).pop() || 'video.mp4';
  const stem = fileName.replace(/\.[^.]+$/, '').replace(/_vertical$/i, '');
  return `${stem}_vertical_${index}.mp4`;
}

export function normalizeProjectSplitConfig(project) {
  return {
    enabled: project.vertical_split_enabled ?? false,
    splitPoints: project.vertical_split_points ?? [],
    overlapSeconds: project.vertical_overlap_seconds ?? 5
  };
}
