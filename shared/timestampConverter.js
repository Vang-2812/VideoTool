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

export function parseSrtWordCues(srtContent) {
  if (!srtContent || !srtContent.trim()) return [];

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const parts = block.trim().split('\n');
    if (parts.length < 3) continue;

    const timeLine = parts[1];
    const textLines = parts.slice(2).join(' ').trim();

    const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->/);
    if (!timeMatch) continue;

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    const ms = parseInt(timeMatch[4], 10);

    const startMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
    const cleanWord = textLines.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

    cues.push({
      text: textLines,
      cleanWord,
      startMs,
      hours,
      minutes,
      seconds,
      ms
    });
  }

  return cues;
}

export function formatMsTimestamp(totalMs, includeMs = false) {
  let totalSecs = Math.floor(totalMs / 1000);
  const remMs = totalMs % 1000;

  if (!includeMs) {
    if (remMs >= 500) {
      totalSecs += 1;
    }
  }

  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const msStr = String(remMs).padStart(3, '0');
  const sStr = String(s).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  const hStr = String(h).padStart(2, '0');

  if (includeMs) {
    return h > 0 ? `[${hStr}:${mStr}:${sStr}:${msStr}]` : `[${mStr}:${sStr}:${msStr}]`;
  } else {
    return h > 0 ? `[${hStr}:${mStr}:${sStr}]` : `[${mStr}:${sStr}]`;
  }
}

export function mapScriptToSrtTimestamps(scriptText, srtContent, options = {}) {
  if (!scriptText || !scriptText.trim() || !srtContent || !srtContent.trim()) {
    return scriptText || '';
  }

  const srtCues = parseSrtWordCues(srtContent);
  if (srtCues.length === 0) return scriptText;

  const includeMs = !!options.includeMs;
  const rawLines = scriptText.split(/\r?\n/);
  const resultLines = [];
  let srtIndex = 0;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      resultLines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    const cleanWordsInLine = words.map(w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    if (cleanWordsInLine.length === 0) {
      resultLines.push(trimmed);
      continue;
    }

    const firstWordClean = cleanWordsInLine[0];
    let matchedMs = null;
    let matchK = -1;

    for (let k = srtIndex; k < srtCues.length; k++) {
      if (srtCues[k].cleanWord === firstWordClean) {
        matchedMs = srtCues[k].startMs;
        matchK = k;
        break;
      }
    }

    if (matchedMs !== null) {
      // Advance srtIndex past the matched paragraph to prevent overlapping matches
      let p = matchK;
      for (let i = 0; i < cleanWordsInLine.length; i++) {
        const cw = cleanWordsInLine[i];
        if (p < srtCues.length && srtCues[p].cleanWord === cw) {
          if (p > matchK) {
            // If pause between consecutive cues > 1000ms, stop advancing (likely next paragraph)
            if (srtCues[p].startMs - srtCues[p - 1].startMs > 1000) {
              break;
            }
          }
          p++;
        }
      }
      // Ensure we advance at least by 1 (the first word)
      srtIndex = Math.max(matchK + 1, p);

      const tsTag = formatMsTimestamp(matchedMs, includeMs);
      resultLines.push(`${tsTag} ${trimmed}`);
    } else {
      resultLines.push(trimmed);
    }
  }

  return resultLines.join('\n');
}

