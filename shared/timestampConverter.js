/**
 * Utility to convert SRT subtitle content into timestamp text format: [mm:ss] text
 */
export function srtToTimestampText(srtContent) {
  if (!srtContent || !srtContent.trim()) return '';

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const lines = [];

  for (const block of blocks) {
    const parts = block.trim().split('\n');
    if (parts.length < 3) continue;

    const timeLine = parts[1];
    const textLines = parts.slice(2).join(' ').trim();

    const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2}),\d{3}\s*-->/);
    if (!timeMatch) continue;

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);

    let formattedTime = '';
    if (hours > 0) {
      const totalHours = String(hours).padStart(2, '0');
      const totalMinutes = String(minutes).padStart(2, '0');
      const totalSecs = String(seconds).padStart(2, '0');
      formattedTime = `[${totalHours}:${totalMinutes}:${totalSecs}]`;
    } else {
      const totalMinutes = String(minutes).padStart(2, '0');
      const totalSecs = String(seconds).padStart(2, '0');
      formattedTime = `[${totalMinutes}:${totalSecs}]`;
    }

    lines.push(`${formattedTime} ${textLines}`);
  }

  return lines.join('\n');
}
