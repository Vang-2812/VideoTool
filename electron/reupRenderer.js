/**
 * FFmpeg Filtergraph Generator & Video Renderer for Reup Module
 */

function escapeFFmpegPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:');
}

export function buildReupFFmpegArgs({
  videoPath,
  blurMask,
  enableVignette,
  enableFlip,
  enableZoom,
  voiceoverAudioPath,
  bgmAudioPath,
  bgmVolume = 0.3,
  outputPath,
  subtitleAssPath
}) {
  const args = ['-y', '-i', videoPath];

  let nextInputIdx = 1;
  let voiceoverInputIdx = -1;
  let bgmInputIdx = -1;

  if (voiceoverAudioPath) {
    args.push('-i', voiceoverAudioPath);
    voiceoverInputIdx = nextInputIdx++;
  }
  if (bgmAudioPath) {
    args.push('-i', bgmAudioPath);
    bgmInputIdx = nextInputIdx++;
  }

  const filtergraph = [];
  let curr_v = '[0:v]';

  // 1. Original subtitle blur mask filter using split & overlay to prevent input reuse
  if (blurMask && blurMask.w > 0 && blurMask.h > 0) {
    const x = blurMask.x / 100;
    const y = blurMask.y / 100;
    const w = blurMask.w / 100;
    const h = blurMask.h / 100;
    
    filtergraph.push(`${curr_v}split=2[v_split1][v_split2]`);
    filtergraph.push(`[v_split1]crop=w=iw*${w}:h=ih*${h}:x=iw*${x}:y=ih*${y},boxblur=luma_radius=15:luma_power=2[blur]`);
    
    const hasMoreFilters = enableFlip || enableVignette || enableZoom || subtitleAssPath;
    const blurOutLabel = hasMoreFilters ? '[v_blurred]' : '[vout]';
    filtergraph.push(`[v_split2][blur]overlay=x=iw*${x}:y=ih*${y}${blurOutLabel}`);
    curr_v = blurOutLabel;
  }

  // 2. Anti-copyright visual filters
  const nextFilters = [];
  if (enableFlip) {
    nextFilters.push('hflip');
  }
  if (enableVignette) {
    nextFilters.push('vignette=PI/4');
  }
  if (enableZoom) {
    nextFilters.push('crop=iw*0.96:ih*0.96,scale=iw:ih');
  }

  if (nextFilters.length > 0) {
    const hasSubtitle = !!subtitleAssPath;
    const nextOutLabel = hasSubtitle ? '[v_filtered]' : '[vout]';
    filtergraph.push(`${curr_v}${nextFilters.join(',')}${nextOutLabel}`);
    curr_v = nextOutLabel;
  }

  // 3. Subtitle burning
  if (subtitleAssPath) {
    const escapedAss = escapeFFmpegPath(subtitleAssPath);
    filtergraph.push(`${curr_v}subtitles='${escapedAss}'[vout]`);
    curr_v = '[vout]';
  }

  // 4. Audio mixing
  let hasAudioFilter = false;
  if (voiceoverInputIdx !== -1 && bgmInputIdx !== -1) {
    filtergraph.push(`[${voiceoverInputIdx}:a][${bgmInputIdx}:a]amix=inputs=2:duration=first:weights=1.0 ${bgmVolume}[aout]`);
    hasAudioFilter = true;
  } else if (voiceoverInputIdx !== -1) {
    filtergraph.push(`[${voiceoverInputIdx}:a]volume=1.0[aout]`);
    hasAudioFilter = true;
  } else if (bgmInputIdx !== -1) {
    // If we have BGM but no voiceover, mix BGM with original video's audio [0:a]
    filtergraph.push(`[0:a][${bgmInputIdx}:a]amix=inputs=2:duration=first:weights=1.0 ${bgmVolume}[aout]`);
    hasAudioFilter = true;
  }

  // 5. Build final args
  if (filtergraph.length > 0) {
    args.push('-filter_complex', filtergraph.join(';'));
    
    // Map video stream
    const hasVideoFilters = (blurMask && blurMask.w > 0 && blurMask.h > 0) || enableFlip || enableVignette || enableZoom || subtitleAssPath;
    if (hasVideoFilters) {
      args.push('-map', '[vout]');
    } else {
      args.push('-map', '0:v');
    }

    // Map audio stream
    if (hasAudioFilter) {
      args.push('-map', '[aout]');
    } else {
      args.push('-map', '0:a?');
    }
  } else {
    // No filters at all, map original streams
    args.push('-map', '0:v', '-map', '0:a?');
  }

  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', outputPath);
  return args;
}
