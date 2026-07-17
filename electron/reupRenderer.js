/**
 * FFmpeg Filtergraph Generator & Video Renderer for Reup Module
 */

export function buildReupFFmpegArgs({
  videoPath,
  blurMask,
  enableVignette,
  enableFlip,
  enableZoom,
  voiceoverAudioPath,
  bgmAudioPath,
  bgmVolume = 0.3,
  outputPath
}) {
  const args = ['-y', '-i', videoPath];

  if (voiceoverAudioPath) {
    args.push('-i', voiceoverAudioPath);
  }
  if (bgmAudioPath) {
    args.push('-i', bgmAudioPath);
  }

  const videoFilters = [];

  // Original subtitle blur mask filter
  if (blurMask && blurMask.w > 0 && blurMask.h > 0) {
    videoFilters.push(
      `crop=w=iw*${blurMask.w/100}:h=ih*${blurMask.h/100}:x=iw*${blurMask.x/100}:y=ih*${blurMask.y/100},boxblur=luma_radius=15:luma_power=2[blur];[0:v][blur]overlay=x=iw*${blurMask.x/100}:y=ih*${blurMask.y/100}`
    );
  }

  // Anti-copyright visual filters
  if (enableFlip) {
    videoFilters.push('hflip');
  }
  if (enableVignette) {
    videoFilters.push('vignette=PI/4');
  }
  if (enableZoom) {
    videoFilters.push('crop=iw*0.96:ih*0.96,scale=iw:ih');
  }

  const filtergraph = [];
  if (videoFilters.length > 0) {
    filtergraph.push(`[0:v]${videoFilters.join(',')}[vout]`);
  }

  // Audio mixing filter
  if (voiceoverAudioPath && bgmAudioPath) {
    filtergraph.push(`[1:a][2:a]amix=inputs=2:duration=first:weights=1.0 ${bgmVolume}[aout]`);
  } else if (voiceoverAudioPath) {
    filtergraph.push(`[1:a]volume=1.0[aout]`);
  }

  if (filtergraph.length > 0) {
    args.push('-filter_complex', filtergraph.join(';'));
    if (videoFilters.length > 0) args.push('-map', '[vout]');
    if (voiceoverAudioPath) args.push('-map', '[aout]');
  }

  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', outputPath);
  return args;
}
