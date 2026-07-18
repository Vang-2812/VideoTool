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
  voiceoverSegments,
  bgmAudioPath,
  bgmVolume = 0.3,
  ttsVolume = 1.0,
  muteOriginalAudio = false,
  outputPath,
  subtitleAssPath
}) {
  const args = ['-y', '-i', videoPath];

  let nextInputIdx = 1;
  let voiceoverInputIdx = -1;
  let bgmInputIdx = -1;
  let voiceoverStartIdx = -1;
  let voiceoverCount = 0;

  if (voiceoverAudioPath) {
    args.push('-i', voiceoverAudioPath);
    voiceoverInputIdx = nextInputIdx++;
  }
  if (bgmAudioPath) {
    args.push('-i', bgmAudioPath);
    bgmInputIdx = nextInputIdx++;
  }
  if (voiceoverSegments && voiceoverSegments.length > 0) {
    voiceoverStartIdx = nextInputIdx;
    voiceoverCount = voiceoverSegments.length;
    voiceoverSegments.forEach(seg => {
      args.push('-i', seg.path);
      nextInputIdx++;
    });
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
    filtergraph.push(`[v_split2][blur]overlay=x=main_w*${x}:y=main_h*${y}${blurOutLabel}`);
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
  let voiceoverLabel = '';

  if (voiceoverCount > 0) {
    const delayedLabels = [];
    for (let i = 0; i < voiceoverCount; i++) {
      const seg = voiceoverSegments[i];
      const delayMs = Math.round(seg.start * 1000);
      const inputLabel = `[${voiceoverStartIdx + i}:a]`;
      const outLabel = `[voseg_${i}]`;
      filtergraph.push(`${inputLabel}adelay=${delayMs}|${delayMs}${outLabel}`);
      delayedLabels.push(outLabel);
    }
    
    if (voiceoverCount === 1) {
      filtergraph.push(`${delayedLabels[0]}volume=${ttsVolume}[voiceover_mixed]`);
      voiceoverLabel = '[voiceover_mixed]';
    } else {
      filtergraph.push(`${delayedLabels.join('')}amix=inputs=${voiceoverCount}:duration=longest:normalize=0,volume=${ttsVolume}[voiceover_mixed]`);
      voiceoverLabel = '[voiceover_mixed]';
    }
  } else if (voiceoverInputIdx !== -1) {
    filtergraph.push(`[${voiceoverInputIdx}:a]volume=${ttsVolume}[voiceover_mixed]`);
    voiceoverLabel = `[voiceover_mixed]`;
  }

  const mixInputs = [];
  const mixWeights = [];
  
  if (!muteOriginalAudio) {
    mixInputs.push('[0:a]');
    mixWeights.push('1.0');
  }
  
  if (voiceoverLabel) {
    mixInputs.push(voiceoverLabel);
    mixWeights.push('1.0');
  }
  
  if (bgmInputIdx !== -1) {
    mixInputs.push(`[${bgmInputIdx}:a]`);
    mixWeights.push(bgmVolume.toString());
  }

  if (mixInputs.length > 1) {
    const mixDuration = mixInputs.includes('[0:a]') ? 'first' : 'longest';
    filtergraph.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=${mixDuration}:dropout_transition=0:weights=${mixWeights.join(' ')}[aout]`);
    hasAudioFilter = true;
  } else if (mixInputs.length === 1 && mixInputs[0] !== '[0:a]') {
    filtergraph.push(`${mixInputs[0]}volume=1.0[aout]`);
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
    } else if (!muteOriginalAudio) {
      args.push('-map', '0:a');
    }
  } else {
    // No filters at all, map original streams
    args.push('-map', '0:v', '-map', '0:a?');
  }

  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', outputPath);
  return args;
}
