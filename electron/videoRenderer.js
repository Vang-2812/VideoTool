import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';
import ffmpegStatic from 'ffmpeg-static';
const ffmpegPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');

const execAsync = util.promisify(exec);

// Tracks running processes for cancellation
let activeProcesses = [];
let renderCancelled = false;

/**
 * Resets the cancellation state and process registry.
 */
export function initRenderJob() {
  renderCancelled = false;
  activeProcesses = [];
}

/**
 * Cancels all active child processes and marks the job as cancelled.
 */
export function cancelActiveRender() {
  renderCancelled = true;
  console.log(`Cancelling active render. Killing ${activeProcesses.length} processes...`);
  
  for (const proc of activeProcesses) {
    try {
      proc.kill('SIGKILL');
    } catch (err) {
      console.error('Error killing process:', err);
    }
  }
  activeProcesses = [];
}

/**
 * Helper to run a shell command while registering the process for cancellation.
 */
function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    if (renderCancelled) {
      return reject(new Error('Process cancelled by user'));
    }

    const proc = exec(command, options, (error, stdout, stderr) => {
      activeProcesses = activeProcesses.filter(p => p !== proc);
      
      if (error) {
        if (renderCancelled || error.killed) {
          reject(new Error('Process cancelled by user'));
        } else {
          reject(new Error(stderr || error.message));
        }
      } else {
        resolve({ stdout, stderr });
      }
    });

    activeProcesses.push(proc);
  });
}

/**
 * Calculates transition durations at each boundary (FR-2.5, FR-2.6).
 * Safe to be imported by main/renderer processes.
 */
export function calculateTransitionDurations(files, T) {
  const n = files.length;
  if (n <= 1) return [];
  
  const transitions = [];
  
  for (let i = 1; i < n; i++) {
    const d_prev = files[i - 1].duration;
    const d_curr = files[i].duration;
    
    // First slide has no start transition. Last slide has no end transition.
    // Middle slides have transitions on both sides, so they must split their duration.
    const limit_prev = (i - 1 === 0) ? d_prev : d_prev / 2;
    const limit_curr = (i === n - 1) ? d_curr : d_curr / 2;
    
    let t_prime = Math.min(T, limit_prev, limit_curr);
    let fallback = false;
    
    if (t_prime < 0.05) {
      t_prime = 0;
      fallback = true;
    }
    
    transitions.push({
      duration: t_prime,
      fallbackHardCut: fallback
    });
  }
  
  return transitions;
}

/**
 * Generates the FFmpeg xfade filter chain for blending image video clips.
 */
function buildTransitionFilterScript(files, transitions, type) {
  let script = '';
  let lastOut = '0:v';
  
  for (let i = 1; i < files.length; i++) {
    const t = transitions[i - 1];
    const nextOut = `v_out_${i}`;
    
    // FFmpeg xfade does not support duration=0, so if hard cut, use a 0.001s transition
    const duration = t.duration > 0 ? t.duration : 0.001;
    const offset = files[i].startTime - (t.duration > 0 ? t.duration : 0);
    const ftype = type === 'fade_black' ? 'fadeblack' : 'dissolve';
    
    script += `[${lastOut}][${i}:v]xfade=transition=${ftype}:duration=${duration.toFixed(3)}:offset=${offset.toFixed(3)}[${nextOut}];\n`;
    lastOut = nextOut;
  }
  
  return { script, lastOut };
}

/**
 * Generates the FFmpeg zoompan filter for Ken Burns effect (FR-3.2).
 */
function buildZoompanFilter(file, d_prime, fps, w, h) {
  const z_limit = file.kbZoomLimit ?? 1.1;
  const z_dir = file.kbZoomDirection ?? 'in';
  const anchor = file.kbPanAnchor ?? 'center';
  const totalFrames = Math.max(1, Math.ceil(d_prime * fps));
  
  const step_z = (totalFrames > 1) ? (z_limit - 1.0) / (totalFrames - 1) : 0;
  
  let z_expr = '';
  if (z_dir === 'in') {
    z_expr = `1.0+(on-1)*(${step_z.toFixed(6)})`;
  } else {
    z_expr = `${z_limit.toFixed(3)}-(on-1)*(${step_z.toFixed(6)})`;
  }
  
  let x_expr = '0';
  let y_expr = '0';
  
  switch (anchor) {
    case 'center':
      x_expr = 'trunc((iw-iw/zoom)/2)';
      y_expr = 'trunc((ih-ih/zoom)/2)';
      break;
    case 'top-left':
      x_expr = '0';
      y_expr = '0';
      break;
    case 'top-right':
      x_expr = 'trunc(iw-iw/zoom)';
      y_expr = '0';
      break;
    case 'bottom-left':
      x_expr = '0';
      y_expr = 'trunc(ih-ih/zoom)';
      break;
    case 'bottom-right':
      x_expr = 'trunc(iw-iw/zoom)';
      y_expr = 'trunc(ih-ih/zoom)';
      break;
  }
  
  return `zoompan=z='${z_expr}':x='${x_expr}':y='${y_expr}':d=1:s=${w}x${h}:fps=${fps}`;
}

/**
 * Generates the FFmpeg complex filter script for mixing audio files (adelay + amix).
 */
function buildAudioFilterScript(files, voiceAudioPath, sfxInputMap, voiceVolumeMultiplier, sfxVolumeMultiplier) {
  let script = '';
  
  // 1. Group files by unique SFX path to know how many splits we need
  const sfxUsageCounts = {};
  for (const file of files) {
    if (file.sfxPath) {
      sfxUsageCounts[file.sfxPath] = (sfxUsageCounts[file.sfxPath] || 0) + 1;
    }
  }

  // 2. Generate asplit for each unique SFX input
  const sfxSplits = {};
  for (const sfxPath in sfxUsageCounts) {
    const inputIdx = sfxInputMap[sfxPath];
    const count = sfxUsageCounts[sfxPath];
    
    if (count > 1) {
      let splitLabels = '';
      sfxSplits[sfxPath] = [];
      for (let j = 0; j < count; j++) {
        const label = `sfx_${inputIdx}_${j}`;
        sfxSplits[sfxPath].push(label);
        splitLabels += `[${label}]`;
      }
      script += `[${inputIdx}:a]asplit=${count}${splitLabels};\n`;
    } else {
      sfxSplits[sfxPath] = [`${inputIdx}:a`];
    }
  }

  // 3. For each image with SFX, apply trim, delay, volume
  const delayedLabels = [];
  const sfxUsageIndices = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.sfxPath) {
      const inputIdx = sfxInputMap[file.sfxPath];
      const useIdx = sfxUsageIndices[file.sfxPath] || 0;
      sfxUsageIndices[file.sfxPath] = useIdx + 1;
      
      const sourceStreamLabel = sfxSplits[file.sfxPath][useIdx];
      const delayedLabel = `delayed_${i}`;
      delayedLabels.push(`[${delayedLabel}]`);
      
      const duration = file.duration;
      const delayMs = Math.round(file.startTime * 1000);
      
      script += `[${sourceStreamLabel}]atrim=end=${duration},asetpts=PTS-STARTPTS,adelay=delays=${delayMs}:all=1,volume=${sfxVolumeMultiplier}[${delayedLabel}];\n`;
    }
  }

  // 4. Voice volume filter
  if (voiceAudioPath) {
    script += `[0:a]volume=${voiceVolumeMultiplier}[voice_a];\n`;
  }

  // 5. Mix all streams together
  const voiceStreamLabel = voiceAudioPath ? '[voice_a]' : '';
  const mixInputsCount = (voiceAudioPath ? 1 : 0) + delayedLabels.length;
  
  if (mixInputsCount > 1) {
    script += `${voiceStreamLabel}${delayedLabels.join('')}amix=inputs=${mixInputsCount}:duration=longest:dropout_transition=0:normalize=0[out_a]\n`;
  } else if (mixInputsCount === 1) {
    if (voiceAudioPath) {
      script += `[voice_a]volume=1.0[out_a]\n`;
    } else {
      script += `${delayedLabels[0]}volume=1.0[out_a]\n`;
    }
  }
  
  return script;
}

/**
 * Main render function triggered from main.js.
 */
export async function renderStoryboardToVideo(settings, onProgress) {
  initRenderJob();
  
  const { 
    directoryPath, 
    resolution, 
    bitrateMbps, 
    fps, 
    resizeMode, 
    totalDuration, 
    files, 
    outputPath,
    voiceAudioPath,
    transitionEnabled,
    transitionType,
    transitionDuration,
    kenBurnsEnabled
  } = settings;

  // Create a unique temp directory in the output directory
  const tempDirName = `video_render_temp_${Date.now()}`;
  const outputDir = path.dirname(outputPath);
  const tempDir = path.join(outputDir, tempDirName);
  
  console.log('Starting render job v1.3. Temp directory:', tempDir);
  onProgress({ progress: 0, eta: 'Initializing...' });

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Parse resolution
    const [widthStr, heightStr] = resolution.split('x');
    const w = parseInt(widthStr, 10) || 1920;
    const h = parseInt(heightStr, 10) || 1080;

    // Define resizing filter
    let filter = '';
    if (resizeMode === 'stretch') {
      filter = `scale=${w}:${h},setsar=1`;
    } else if (resizeMode === 'fill') {
      filter = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
    } else {
      filter = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
    }

    const totalFiles = files.length;
    const concurrencyLimit = 6;
    const hasAudio = !!voiceAudioPath || files.some(f => f.sfxPath);
    const tempVideoPath = hasAudio ? path.join(tempDir, 'silent_video.mp4') : outputPath;

    // Determine if we need to generate individual clips first
    const needsClips = transitionEnabled || kenBurnsEnabled;

    if (needsClips) {
      // clip-based pipeline (Phase B/C)
      console.log('Transition or Ken Burns is enabled. Generating individual video clips...');
      
      // Calculate transition durations and clip lengths
      const transitions = calculateTransitionDurations(files, transitionDuration ?? 0.5);
      const clipDurations = [];
      
      for (let i = 0; i < totalFiles; i++) {
        const d = files[i].duration;
        if (i === 0) {
          clipDurations.push(d); // First slide has no start transition offset extension
        } else {
          // Extension includes the transition duration at the start
          const t_prev = transitions[i - 1].duration;
          clipDurations.push(d + t_prev);
        }
      }

      // Generate clip_i.mp4 for each image
      for (let i = 0; i < totalFiles; i += concurrencyLimit) {
        if (renderCancelled) throw new Error('Process cancelled by user');

        const batch = files.slice(i, i + concurrencyLimit).map(async (file, batchIdx) => {
          const globalIdx = i + batchIdx;
          const d_prime = clipDurations[globalIdx];
          
          let clipFilter = filter;
          if (kenBurnsEnabled) {
            clipFilter = filter + ',' + buildZoompanFilter(file, d_prime, fps, w, h);
          }
          
          const cmd = `"${ffmpegPath}" -loop 1 -i "${file.path}" -vf "${clipFilter}" -c:v libx264 -pix_fmt yuv420p -r ${fps} -t ${d_prime.toFixed(3)} -y "clip_${globalIdx}.mp4"`;
          await runCommand(cmd, { cwd: tempDir });

          const resizeProgress = ((globalIdx + 1) / totalFiles) * 35;
          onProgress({ 
            progress: resizeProgress, 
            eta: `Generating video segments (${globalIdx + 1}/${totalFiles})...` 
          });
        });

        await Promise.all(batch);
      }

      if (renderCancelled) throw new Error('Process cancelled by user');
      onProgress({ progress: 35, eta: 'Merging segments...' });

      // Merge clips together
      if (transitionEnabled) {
        // Write transition script file
        const { script, lastOut } = buildTransitionFilterScript(files, transitions, transitionType);
        const transitionScriptPath = path.join(tempDir, 'transition_filter.txt');
        await fs.writeFile(transitionScriptPath, script, 'utf-8');
        
        let inputsCmd = '';
        for (let i = 0; i < totalFiles; i++) {
          inputsCmd += `-i "clip_${i}.mp4" `;
        }
        
        const mergeCmd = `"${ffmpegPath}" ${inputsCmd}-filter_complex_script "transition_filter.txt" -map "[${lastOut}]" -c:v libx264 -pix_fmt yuv420p -b:v ${bitrateMbps}M -r ${fps} -y "${tempVideoPath}"`;
        console.log('Executing transition merge command in tempDir:', mergeCmd);
        
        await runCommand(mergeCmd, { cwd: tempDir });
      } else {
        // Only Ken Burns is enabled, concat demux clips together (fast)
        const concatFilePath = path.join(tempDir, 'concat_clips.txt');
        let concatClipsContent = '';
        for (let i = 0; i < totalFiles; i++) {
          concatClipsContent += `file 'clip_${i}.mp4'\n`;
        }
        await fs.writeFile(concatFilePath, concatClipsContent, 'utf-8');
        
        const mergeCmd = `"${ffmpegPath}" -f concat -safe 0 -i "concat_clips.txt" -c:v copy -y "${tempVideoPath}"`;
        console.log('Executing clip concat command in tempDir:', mergeCmd);
        
        await runCommand(mergeCmd, { cwd: tempDir });
      }
      
      // Update progress
      onProgress({ progress: 70, eta: '00:00' });

    } else {
      // standard Concat Demuxer pipeline (v1.2 regression path)
      console.log('Regression path: Concat Demuxer on images.');
      
      for (let i = 0; i < totalFiles; i += concurrencyLimit) {
        if (renderCancelled) throw new Error('Process cancelled by user');

        const batch = files.slice(i, i + concurrencyLimit).map(async (file, batchIdx) => {
          const globalIdx = i + batchIdx;
          const tempImgPath = path.join(tempDir, `img_${globalIdx}.png`);
          
          const cmd = `"${ffmpegPath}" -i "${file.path}" -vf "${filter}" -y "${tempImgPath}"`;
          await runCommand(cmd);

          const resizeProgress = ((globalIdx + 1) / totalFiles) * 35;
          onProgress({ 
            progress: resizeProgress, 
            eta: `Resizing images (${globalIdx + 1}/${totalFiles})...` 
          });
        });

        await Promise.all(batch);
      }

      if (renderCancelled) throw new Error('Process cancelled by user');

      const concatFilePath = path.join(tempDir, 'concat.txt');
      let concatContent = '';
      
      for (let i = 0; i < totalFiles; i++) {
        const tempImgPath = path.join(tempDir, `img_${i}.png`);
        const escapedPath = tempImgPath.replace(/\\/g, '/');
        concatContent += `file '${escapedPath}'\n`;
        concatContent += `duration ${files[i].duration}\n`;
      }
      
      if (totalFiles > 0) {
        const tempImgPath = path.join(tempDir, `img_${totalFiles - 1}.png`);
        const escapedPath = tempImgPath.replace(/\\/g, '/');
        concatContent += `file '${escapedPath}'\n`;
      }

      await fs.writeFile(concatFilePath, concatContent, 'utf-8');
      
      if (renderCancelled) throw new Error('Process cancelled by user');

      const totalFrames = Math.ceil(totalDuration * fps);
      const encodeCmd = `"${ffmpegPath}" -f concat -safe 0 -i "${concatFilePath}" -c:v libx264 -pix_fmt yuv420p -b:v ${bitrateMbps}M -r ${fps} -y "${tempVideoPath}"`;
      
      await new Promise((resolve, reject) => {
        if (renderCancelled) return reject(new Error('Process cancelled by user'));

        const proc = exec(encodeCmd, (error, stdout, stderr) => {
          activeProcesses = activeProcesses.filter(p => p !== proc);
          if (error) {
            if (renderCancelled || error.killed) {
              reject(new Error('Process cancelled by user'));
            } else {
              reject(new Error(stderr || error.message));
            }
          } else {
            resolve(true);
          }
        });

        activeProcesses.push(proc);

        let buffer = '';
        proc.stderr.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\r');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const frameMatch = line.match(/frame=\s*(\d+)/);
            if (frameMatch) {
              const currentFrame = parseInt(frameMatch[1], 10);
              const encodeProgress = 35 + ((currentFrame / totalFrames) * 35);
              const finalProgress = Math.min(70, encodeProgress);
              
              const speedMatch = line.match(/speed=\s*([\d\.]+)x/);
              let eta = 'Calculating...';
              if (speedMatch && parseFloat(speedMatch[1]) > 0) {
                const speed = parseFloat(speedMatch[1]);
                const secondsRemaining = (totalDuration - (currentFrame / fps)) / speed;
                if (secondsRemaining > 0) {
                  const m = Math.floor(secondsRemaining / 60);
                  const s = Math.floor(secondsRemaining % 60);
                  eta = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                } else {
                  eta = '00:00';
                }
              }

              onProgress({
                progress: finalProgress,
                eta,
                currentFrame,
                totalFrames
              });
            }
          }
        });
      });
    }

    if (renderCancelled) throw new Error('Process cancelled by user');

    // 7. Handle Audio Mixing and Muxing
    if (hasAudio) {
      const totalFrames = Math.ceil(totalDuration * fps);
      onProgress({ progress: 70, eta: '00:00', currentFrame: totalFrames, totalFrames });
      
      const assignedSfxPaths = files.map(f => f.sfxPath).filter(Boolean);
      const uniqueSfxPaths = Array.from(new Set(assignedSfxPaths));
      
      let audioSourcePath = voiceAudioPath;
      const voiceVolumeDb = settings.voiceVolumeDb ?? 0;
      const sfxVolumeDb = settings.sfxVolumeDb ?? -12;
      
      const voiceVolumeMultiplier = Math.pow(10, voiceVolumeDb / 20);
      const sfxVolumeMultiplier = Math.pow(10, sfxVolumeDb / 20);

      if (uniqueSfxPaths.length > 0) {
        onProgress({ progress: 72, eta: 'Mixing audio...' });
        
        const sfxInputsStartIdx = voiceAudioPath ? 1 : 0;
        const sfxInputMap = {};
        uniqueSfxPaths.forEach((sfxPath, idx) => {
          sfxInputMap[sfxPath] = sfxInputsStartIdx + idx;
        });
        
        const filterScriptContent = buildAudioFilterScript(
          files, 
          voiceAudioPath, 
          sfxInputMap, 
          voiceVolumeMultiplier,
          sfxVolumeMultiplier
        );
        
        const filterScriptPath = path.join(tempDir, 'audio_filter.txt');
        await fs.writeFile(filterScriptPath, filterScriptContent, 'utf-8');
        
        let inputsCmd = '';
        if (voiceAudioPath) {
          inputsCmd += `-i "${voiceAudioPath}" `;
        }
        for (const sfxPath of uniqueSfxPaths) {
          inputsCmd += `-i "${sfxPath}" `;
        }
        
        const tempAudioPath = path.join(tempDir, 'mixed_audio.wav');
        const mixCmd = `"${ffmpegPath}" ${inputsCmd}-filter_complex_script "${filterScriptPath}" -map "[out_a]" -c:a pcm_s16le -y "${tempAudioPath}"`;
        
        await runCommand(mixCmd);
        audioSourcePath = tempAudioPath;
      } else if (voiceAudioPath && voiceVolumeDb !== 0) {
        onProgress({ progress: 72, eta: 'Adjusting voice volume...' });
        
        const tempAudioPath = path.join(tempDir, 'mixed_audio.wav');
        const volCmd = `"${ffmpegPath}" -i "${voiceAudioPath}" -af "volume=${voiceVolumeMultiplier}" -c:a pcm_s16le -y "${tempAudioPath}"`;
        
        await runCommand(volCmd);
        audioSourcePath = tempAudioPath;
      }
      
      if (renderCancelled) throw new Error('Process cancelled by user');
      onProgress({ progress: 85, eta: 'Muxing video & audio...' });
      
      const muxCmd = `"${ffmpegPath}" -i "${tempVideoPath}" -i "${audioSourcePath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -y "${outputPath}"`;
      await runCommand(muxCmd);
    }

    console.log('Video rendering complete!');
    onProgress({ progress: 100, eta: '00:00' });

    const stats = await fs.stat(outputPath);

    return {
      success: true,
      videoPath: outputPath,
      sizeBytes: stats.size,
      duration: totalDuration
    };

  } catch (err) {
    console.error('Error during render pipeline:', err);
    throw err;
  } finally {
    console.log('Cleaning up temporary directory:', tempDir);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('Failed to delete temp directory:', cleanupErr);
    }
  }
}
