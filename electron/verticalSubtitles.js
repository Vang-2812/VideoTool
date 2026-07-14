import fs from 'node:fs/promises';

function parseSrtTime(value) {
  const [hours, minutes, rest] = value.replace(',', '.').split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
}

export function parseSrtCues(content) {
  return content.split(/\r?\n\r?\n/).filter(Boolean).flatMap((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) return [];
    const [start, end] = lines[timeIndex].split('-->').map((value) => parseSrtTime(value.trim()));
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? [{ start, end, text: lines.slice(timeIndex + 1).join('\\N') }]
      : [];
  });
}

export function sliceAndRebaseCues(cues, startTime, endTime) {
  return cues
    .filter((cue) => cue.end > startTime && cue.start < endTime)
    .map((cue) => ({
      start: Math.max(cue.start, startTime) - startTime,
      end: Math.min(cue.end, endTime) - startTime,
      text: cue.text
    }))
    .filter((cue) => cue.end > cue.start);
}

function hexToAssColor(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '&H00FFFFFF';
  return `&H00${full.slice(4, 6)}${full.slice(2, 4)}${full.slice(0, 2)}`;
}

function formatAssTime(value) {
  const centiseconds = Math.max(0, Math.round(value * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const fraction = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
}

function buildAssDocument(cues, subtitleFontSize, subtitleColor, subtitleMarginV) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${subtitleFontSize},${hexToAssColor(subtitleColor)},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,80,80,${subtitleMarginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = cues.map((cue) =>
    `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${cue.text}`
  );
  return header + events.join('\n');
}

export async function convertSrtToAss({ srtPath, assPath, subtitleFontSize = 54, subtitleColor = '#FFFF00', subtitleMarginV = 180, startTime, endTime }) {
  const content = await fs.readFile(srtPath, 'utf8');
  const parsed = parseSrtCues(content);
  const cues = Number.isFinite(startTime) && Number.isFinite(endTime)
    ? sliceAndRebaseCues(parsed, startTime, endTime)
    : parsed;
  await fs.writeFile(assPath, buildAssDocument(cues, subtitleFontSize, subtitleColor, subtitleMarginV), 'utf8');
}
