import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, nativeImage, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import https from 'https';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawn, exec } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { alignScriptAndWhisper } from './whisperAligner.js';
import { groupWordsByScriptSentences } from '../shared/scriptSentenceParser.js';
import { srtToTimestampText } from '../shared/timestampConverter.js';
import { translateSegments } from './translators/translatorFactory.js';
import { buildReupFFmpegArgs } from './reupRenderer.js';
import { parseStoryboardDirectory } from './fileParser.js';
import { renderStoryboardToVideo, cancelActiveRender } from './videoRenderer.js';
import { readAudioDuration } from './audioMetadata.js';
import { OAuth2Client } from 'google-auth-library';
import { convertToVertical, getVideoDuration } from './verticalConverter.js';
import { convertToVerticalBatch, cancelVerticalBatch } from './verticalBatchConverter.js';
import http from 'http';
import { createPcmFileSink, finalizePcmOutput } from './tts/audioAssembler.js';
import { createChirpClient, synthesizeChirpStreaming } from './tts/chirpStreamingAdapter.js';
import {
  createCredentialPathStore,
  createRestAccessToken,
  readServiceAccount,
  redactGoogleError,
  validateServiceAccount
} from './tts/googleCredentials.js';
import { synthesizeGoogleRest } from './tts/googleRestAdapter.js';
import { createTtsJobOrchestrator } from './tts/ttsJobOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Register custom media protocol privileges before app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, stream: true } }
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'Storyboard to Video Tool',
    backgroundColor: '#090a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    //mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initializeTtsJobOrchestrator();

  // Register media:// protocol handler to serve local files securely
  protocol.handle('media', (request) => {
    try {
      const filePath = decodeURIComponent(request.url.slice('media://'.length));
      return net.fetch(pathToFileURL(filePath).toString(), {
        headers: request.headers
      });
    } catch (err) {
      console.error('Media protocol handler error:', err);
      return new Response('File not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Chọn thư mục chứa ảnh Storyboard'
  });
  if (result.canceled) return null;
  const dirPath = result.filePaths[0];
  return await parseStoryboardDirectory(dirPath);
});

ipcMain.handle('open-directory', async (_, filePath) => {
  if (!filePath) return;
  try {
    await shell.showItemInFolder(path.normalize(filePath));
  } catch (err) {
    console.error("Failed to open folder for path:", filePath, err);
  }
});

ipcMain.handle('play-video', async (_, filePath) => {
  if (!filePath) return;
  try {
    await shell.openPath(path.normalize(filePath));
  } catch (err) {
    console.error("Failed to play video:", filePath, err);
  }
});

ipcMain.handle('select-save-path', async (_, defaultPath) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'output_video.mp4',
    filters: [{ name: 'Video MP4', extensions: ['mp4'] }],
    title: 'Chọn vị trí lưu video xuất'
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('get-temp-path', async () => {
  return path.join(app.getPath('temp'), `tts_temp_${Date.now()}.mp3`);
});

ipcMain.handle('save-file-from-temp', async (_, { sourcePath, filterName, extension }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `output.${extension}`,
    filters: [{ name: filterName, extensions: [extension] }],
    title: 'Lưu tệp'
  });
  if (result.canceled) return null;
  await fs.copyFile(sourcePath, result.filePath);
  return result.filePath;
});

ipcMain.handle('read-audio-duration', async (_, filePath) => {
  return await readAudioDuration(filePath);
});

ipcMain.handle('select-audio-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav'] }],
    title: 'Chọn file Audio chính'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return {
    path: filePath,
    name: path.basename(filePath)
  };
});

ipcMain.handle('select-sfx-files', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav'] }],
    title: 'Chọn các tệp Sound Effect'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths.map(filePath => ({
    path: filePath,
    name: path.basename(filePath)
  }));
});



ipcMain.handle('render-video', async (event, settings) => {
  try {
    const result = await renderStoryboardToVideo(settings, (progressData) => {
      // Send progress to the frontend renderer process
      event.sender.send('render-progress', progressData);
    });

    if (result.success && settings.verticalExportEnabled) {
      const vertPath = settings.outputPath.replace(/\.mp4$/i, '_vertical.mp4');
      const verticalParams = {
        inputPath: settings.outputPath,
        outputPath: vertPath,
        title: settings.videoTitle,
        srtPath: settings.verticalSrtPath,
        qualityPreset: settings.preset,
        titleFontSize: settings.verticalTitleFontSize,
        subtitleFontSize: settings.verticalSubtitleFontSize,
        titleColor: settings.verticalTitleColor,
        subtitleColor: settings.verticalSubtitleColor,
        titleYPercent: settings.verticalTitleYPercent,
        subtitleMarginV: settings.verticalSubtitleMarginV
      };
      const mapVerticalProgressToOverallRender = (progressData) => {
        event.sender.send('render-progress', {
          progress: 95 + progressData.progress * 0.05,
          eta: `Đang xuất bản dọc... (${progressData.progress}%)`,
          segmentIndex: progressData.segmentIndex,
          segmentCount: progressData.segmentCount
        });
      };
      const splitConfig = settings.verticalSplitConfig;
      if (splitConfig?.enabled) {
        const batchResult = await convertToVerticalBatch({
          ...verticalParams,
          sourceVideoPath: settings.outputPath,
          outputDirectory: path.dirname(settings.outputPath),
          outputBaseName: path.basename(settings.outputPath),
          splitPoints: splitConfig.splitPoints,
          overlapSeconds: splitConfig.overlapSeconds
        }, mapVerticalProgressToOverallRender);
        result.verticalVideoPaths = batchResult.outputPaths;
        if (!batchResult.success) result.verticalError = batchResult.error;
      } else {
        const singleResult = await convertToVertical(verticalParams, mapVerticalProgressToOverallRender);
        if (singleResult.success) result.verticalVideoPaths = [vertPath];
        else result.verticalError = singleResult.error;
      }
    }

    // Send completion success
    event.sender.send('render-complete', result);
    return { success: true };
  } catch (err) {
    console.error('Render video IPC error:', err);
    event.sender.send('render-complete', {
      success: false,
      error: err.message || 'Render failed due to an internal error.'
    });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('cancel-render', async () => {
  cancelActiveRender();
  cancelVerticalBatch();
  return;
});

// ============================================================================
// PROJECT PERSISTENCE HANDLERS (v1.4)
// ============================================================================

const PROJECTS_DIR = path.join(app.getPath('userData'), 'Projects');
const THUMBNAILS_DIR = path.join(PROJECTS_DIR, 'Thumbnails');

async function ensureDirs() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
}

async function generateThumbnail(projectId, firstImagePath) {
  try {
    await ensureDirs();
    const destPath = path.join(THUMBNAILS_DIR, `${projectId}.png`);
    if (!firstImagePath) return null;

    try {
      await fs.access(firstImagePath);
    } catch {
      console.warn('First image path does not exist, skipping thumbnail generation:', firstImagePath);
      return null;
    }

    const img = nativeImage.createFromPath(firstImagePath);
    if (img.isEmpty()) {
      console.warn('Failed to load image for thumbnail:', firstImagePath);
      return null;
    }

    const thumbnail = img.resize({ width: 200, height: 120, quality: 'good' });
    await fs.writeFile(destPath, thumbnail.toPNG());
    return destPath;
  } catch (err) {
    console.error('Error generating thumbnail:', err);
    return null;
  }
}

ipcMain.handle('save-project', async (_, project) => {
  try {
    await ensureDirs();
    const projectId = project.project_id;
    const projectPath = path.join(PROJECTS_DIR, `${projectId}.sbvproj`);

    let thumbnailPath = project.thumbnail_path;
    if (project.files && project.files.length > 0) {
      const firstImagePath = project.files[0].path;
      const newThumbnail = await generateThumbnail(projectId, firstImagePath);
      if (newThumbnail) {
        thumbnailPath = newThumbnail;
      }
    }

    const updatedProject = {
      ...project,
      thumbnail_path: thumbnailPath,
      updated_at: Date.now()
    };

    await fs.writeFile(projectPath, JSON.stringify(updatedProject, null, 2), 'utf-8');
    return { success: true, project: updatedProject };
  } catch (err) {
    console.error('Save project error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-project-list', async () => {
  try {
    await ensureDirs();
    const files = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const list = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.sbvproj')) continue;

      const filePath = path.join(PROJECTS_DIR, file.name);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const project = JSON.parse(content);

        list.push({
          project_id: project.project_id,
          project_name: project.project_name,
          created_at: project.created_at,
          updated_at: project.updated_at,
          thumbnail_path: project.thumbnail_path,
          totalDuration: project.totalDuration,
          filesCount: project.files ? project.files.length : 0
        });
      } catch (e) {
        console.error('Error reading project file:', filePath, e);
      }
    }

    list.sort((a, b) => b.updated_at - a.updated_at);
    return list;
  } catch (err) {
    console.error('Get project list error:', err);
    return [];
  }
});

ipcMain.handle('load-project', async (_, projectId) => {
  try {
    const projectPath = path.join(PROJECTS_DIR, `${projectId}.sbvproj`);
    const content = await fs.readFile(projectPath, 'utf-8');
    return { success: true, project: JSON.parse(content) };
  } catch (err) {
    console.error('Load project error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-project', async (_, projectId) => {
  try {
    const projectPath = path.join(PROJECTS_DIR, `${projectId}.sbvproj`);
    const thumbnailPath = path.join(THUMBNAILS_DIR, `${projectId}.png`);

    try {
      await fs.unlink(projectPath);
    } catch (e) {
      // Ignored
    }

    try {
      await fs.unlink(thumbnailPath);
    } catch (e) {
      // Ignored
    }

    return { success: true };
  } catch (err) {
    console.error('Delete project error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('duplicate-project', async (_, projectId) => {
  try {
    const srcPath = path.join(PROJECTS_DIR, `${projectId}.sbvproj`);
    const content = await fs.readFile(srcPath, 'utf-8');
    const project = JSON.parse(content);

    const newId = require('crypto').randomUUID();
    const newName = `${project.project_name} (Copy)`;
    const newThumbnailPath = path.join(THUMBNAILS_DIR, `${newId}.png`);

    if (project.thumbnail_path) {
      try {
        await fs.copyFile(project.thumbnail_path, newThumbnailPath);
      } catch (e) {
        console.warn('Failed to duplicate thumbnail file:', e);
      }
    }

    const duplicatedProject = {
      ...project,
      project_id: newId,
      project_name: newName,
      created_at: Date.now(),
      updated_at: Date.now(),
      thumbnail_path: project.thumbnail_path ? newThumbnailPath : null
    };

    const destPath = path.join(PROJECTS_DIR, `${newId}.sbvproj`);
    await fs.writeFile(destPath, JSON.stringify(duplicatedProject, null, 2), 'utf-8');

    return { success: true, project: duplicatedProject };
  } catch (err) {
    console.error('Duplicate project error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('check-files-exist', async (_, paths) => {
  const missingPaths = [];
  for (const p of paths) {
    if (!p) continue;
    try {
      await fs.access(p);
    } catch {
      missingPaths.push(p);
    }
  }
  return missingPaths;
});

ipcMain.handle('select-export-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Chọn thư mục đích xuất video'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-relink-file', async (_, extensions) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Resource Files', extensions }],
    title: 'Chọn tệp thay thế'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return {
    path: filePath,
    name: path.basename(filePath)
  };
});

// ============================================================================
// BATCH EXPORT HANDLERS (v1.4)
// ============================================================================

let isBatchCancelled = false;

ipcMain.handle('start-batch-render', async (event, { projectIds, outputDir }) => {
  isBatchCancelled = false;

  for (const id of projectIds) {
    if (isBatchCancelled) {
      break;
    }

    // Notify starting project
    event.sender.send('batch-project-start', { projectId: id });

    try {
      const projectPath = path.join(PROJECTS_DIR, `${id}.sbvproj`);
      const content = await fs.readFile(projectPath, 'utf-8');
      const project = JSON.parse(content);

      // 1. Assets exist check (V-2)
      const assetPaths = [];
      if (project.files) {
        for (const f of project.files) {
          if (f.path) assetPaths.push(f.path);
          if (f.sfxPath) assetPaths.push(f.sfxPath);
        }
      }
      if (project.voiceAudio && project.voiceAudio.path) {
        assetPaths.push(project.voiceAudio.path);
      }
      if (project.sfxPool) {
        for (const s of project.sfxPool) {
          if (s.path) assetPaths.push(s.path);
        }
      }

      const missing = [];
      for (const p of assetPaths) {
        if (!p) continue;
        try {
          await fs.access(p);
        } catch {
          missing.push(p);
        }
      }

      if (missing.length > 0) {
        throw new Error(`Thiếu ${missing.length} tệp tài nguyên trong hệ thống.`);
      }

      // 2. Output path deduplication (FR-3.6 / V-4)
      let baseName = project.project_name || 'untitled';
      baseName = baseName.replace(/[\\/:*?"<>|]/g, '_');
      let outPath = path.join(outputDir, `${baseName}.mp4`);
      let counter = 1;
      while (true) {
        try {
          await fs.access(outPath);
          outPath = path.join(outputDir, `${baseName}_${counter}.mp4`);
          counter++;
        } catch {
          break;
        }
      }

      // 3. Assemble render settings
      const settings = {
        directoryPath: project.directoryPath,
        resolution: project.exportConfig.resolution,
        bitrateMbps: project.exportConfig.bitrateMbps,
        fps: project.exportConfig.fps,
        resizeMode: project.exportConfig.resizeMode,
        totalDuration: project.totalDuration,
        files: project.files,
        outputPath: outPath,
        voiceAudioPath: project.voiceAudio ? project.voiceAudio.path : null,
        voiceVolumeDb: project.voiceVolume ?? 0,
        sfxVolumeDb: project.sfxVolume ?? -12,
        transitionEnabled: project.transitionEnabled ?? false,
        transitionType: project.transitionType ?? 'dissolve',
        transitionDuration: project.transitionDuration ?? 0.5,
        kenBurnsEnabled: project.kenBurnsEnabled ?? false
      };

      // 4. Perform rendering
      const result = await renderStoryboardToVideo(settings, (progressData) => {
        event.sender.send('batch-project-progress', {
          projectId: id,
          progress: progressData.progress,
          eta: progressData.eta
        });
      });

      if (result.success) {
        let verticalVideoPath = undefined;
        let verticalError = undefined;

        if (project.vertical_export_enabled) {
          const vertPath = outPath.replace(/\.mp4$/i, '_vertical.mp4');
          const vertRes = await convertToVertical({
            inputPath: outPath,
            outputPath: vertPath,
            title: project.video_title || project.project_name || 'untitled',
            srtPath: project.vertical_srt_path || null,
            qualityPreset: project.exportConfig?.preset || 'standard',
            titleFontSize: project.vertical_title_font_size || 48,
            subtitleFontSize: project.vertical_subtitle_font_size || 54,
            titleColor: project.vertical_title_color || '#FFFFFF',
            subtitleColor: project.vertical_subtitle_color || '#FFFF00',
            titleYPercent: project.vertical_title_y_percent !== undefined ? project.vertical_title_y_percent : 7.5,
            subtitleMarginV: project.vertical_subtitle_margin_v !== undefined ? project.vertical_subtitle_margin_v : 180
          });
          if (vertRes.success) {
            verticalVideoPath = vertPath;
          } else {
            verticalError = vertRes.error;
          }
        }

        event.sender.send('batch-project-complete', {
          projectId: id,
          success: true,
          videoPath: outPath,
          verticalVideoPath,
          verticalError
        });
      } else {
        event.sender.send('batch-project-complete', {
          projectId: id,
          success: false,
          error: result.error || 'Lỗi render không xác định.'
        });
      }

    } catch (err) {
      console.error(`Batch rendering failed for project ${id}:`, err);
      event.sender.send('batch-project-complete', {
        projectId: id,
        success: false,
        error: err.message || 'Lỗi hệ thống khi nạp dự án.'
      });
    }
  }

  return { success: !isBatchCancelled };
});

ipcMain.handle('cancel-batch-export', async () => {
  isBatchCancelled = true;
  cancelActiveRender();
  return;
});

// ============================================================================
// API KEY & TTS HANDLERS (v1.5)
// ============================================================================

const CONFIG_DIR = path.join(app.getPath('userData'), 'Config');
const API_KEY_FILE = path.join(CONFIG_DIR, 'gcts.key');
const OPENAI_KEY_FILE = path.join(CONFIG_DIR, 'openai.key');
const credentialPathStore = createCredentialPathStore({
  settingsPath: path.join(CONFIG_DIR, 'tts-settings.json')
});
const activeTtsJobs = new Map();
let ttsJobOrchestrator = null;

async function readEncryptedGoogleAuth() {
  const stored = await fs.readFile(API_KEY_FILE);
  return safeStorage?.isEncryptionAvailable()
    ? safeStorage.decryptString(stored)
    : stored.toString('utf8');
}

async function readAnyGoogleAuth() {
  try {
    return await readEncryptedGoogleAuth();
  } catch {
    const credentialsPath = await credentialPathStore.load();
    if (!credentialsPath) {
      throw new Error('Google Cloud authentication is not configured.');
    }
    return JSON.stringify(await readServiceAccount(credentialsPath));
  }
}

function initializeTtsJobOrchestrator() {
  if (ttsJobOrchestrator) return ttsJobOrchestrator;

  ttsJobOrchestrator = createTtsJobOrchestrator({
    hasStreamingCredentials: async () => Boolean(await credentialPathStore.load()),
    createAttempt: async (engine) => {
      const attemptDir = await fs.mkdtemp(
        path.join(app.getPath('temp'), `tts-${engine}-`)
      );
      const pcmPath = path.join(attemptDir, 'audio.pcm');
      const sink = await createPcmFileSink(pcmPath);
      return {
        sink,
        pcmPath,
        close: () => sink.close(),
        remove: () => fs.rm(attemptDir, { recursive: true, force: true })
      };
    },
    stream: async (options) => {
      const credentialsPath = await credentialPathStore.load();
      const credentials = await readServiceAccount(credentialsPath);
      return synthesizeChirpStreaming({ ...options, credentials });
    },
    rest: async (options) => synthesizeGoogleRest({
      ...options,
      fetchImpl: fetch,
      tokenProvider: async () => createRestAccessToken(await readAnyGoogleAuth())
    }),
    finalize: async (options) => finalizePcmOutput({
      ...options,
      ffmpegPath: ffmpegStatic
    }),
    redactError: redactGoogleError
  });
  return ttsJobOrchestrator;
}

async function runTtsJob(event, request) {
  const jobKey = event.sender.id;
  activeTtsJobs.get(jobKey)?.abort();
  const controller = new AbortController();
  activeTtsJobs.set(jobKey, controller);

  try {
    return await initializeTtsJobOrchestrator().run(request, {
      signal: controller.signal,
      onProgress: (payload) => event.sender.send('tts-job-progress', payload)
    });
  } finally {
    if (activeTtsJobs.get(jobKey) === controller) {
      activeTtsJobs.delete(jobKey);
    }
  }
}

async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

ipcMain.handle('save-api-key', async (_, { service, key }) => {
  try {
    await ensureConfigDir();
    const filePath = service === 'openai' ? OPENAI_KEY_FILE : API_KEY_FILE;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key);
      await fs.writeFile(filePath, encrypted);
      return { success: true };
    } else {
      await fs.writeFile(filePath, key, 'utf-8');
      return { success: true, plaintext: true };
    }
  } catch (err) {
    console.error('Error saving API Key:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-api-key', async (_, { service }) => {
  try {
    if (service === 'google') {
      return {
        success: false,
        key: '',
        error: 'Google credentials are available through status APIs only.'
      };
    }
    const filePath = OPENAI_KEY_FILE;
    try {
      await fs.access(filePath);
    } catch {
      return { success: true, key: '' };
    }

    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = await fs.readFile(filePath);
      const key = safeStorage.decryptString(encrypted);
      return { success: true, key };
    } else {
      const key = await fs.readFile(filePath, 'utf-8');
      return { success: true, key };
    }
  } catch (err) {
    console.error('Error reading API Key:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-api-key', async (_, { service }) => {
  try {
    const filePath = service === 'openai' ? OPENAI_KEY_FILE : API_KEY_FILE;
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // Ignored
    }
    return { success: true };
  } catch (err) {
    console.error('Error deleting API Key:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-google-oauth', async (_, { clientId, clientSecret }) => {
  return new Promise((resolve) => {
    const redirectUri = 'http://127.0.0.1:3456/oauth2callback';
    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/cloud-platform'],
      prompt: 'consent' // Force to get refresh token
    });

    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.startsWith('/oauth2callback')) {
          const qs = new URL(req.url, `http://127.0.0.1:3456`).searchParams;
          const code = qs.get('code');
          res.end('<h1>Dang nhap thanh cong!</h1><p>Anh co the dong tab nay va quay lai phan mem.</p><script>window.close()</script>');
          server.close();

          if (code) {
            const { tokens } = await oAuth2Client.getToken(code);
            await ensureConfigDir();
            // Save to API_KEY_FILE
            const payload = JSON.stringify({
              clientId,
              clientSecret,
              refreshToken: tokens.refresh_token || tokens.access_token // some accounts might not return refresh if already granted, but we forced consent
            });

            if (safeStorage && safeStorage.isEncryptionAvailable()) {
              const encrypted = safeStorage.encryptString(payload);
              await fs.writeFile(API_KEY_FILE, encrypted);
            } else {
              await fs.writeFile(API_KEY_FILE, payload, 'utf-8');
            }
            resolve({ success: true });
          } else {
            resolve({ success: false, error: 'Không lấy được mã xác thực từ Google.' });
          }
        }
      } catch (e) {
        server.close();
        resolve({ success: false, error: e.message });
      }
    }).listen(3456, () => {
      shell.openExternal(authorizeUrl);
    });
  });
});

ipcMain.handle('synthesize-speech', runTtsJob);

ipcMain.handle('cancel-tts-job', async (event) => {
  const controller = activeTtsJobs.get(event.sender.id);
  controller?.abort();
  return { success: Boolean(controller) };
});

ipcMain.handle('select-google-credentials-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Google credentials', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) {
    return { status: 'not-configured', path: '' };
  }

  const credentialPath = result.filePaths[0];
  try {
    const validation = await validateServiceAccount(credentialPath, {
      clientFactory: createChirpClient
    });
    await credentialPathStore.save(credentialPath);
    return validation;
  } catch (error) {
    return {
      status: 'invalid',
      path: credentialPath,
      error: redactGoogleError(error)
    };
  }
});

async function getGoogleCredentialsStatus() {
  const credentialPath = await credentialPathStore.load();
  if (!credentialPath) return { status: 'not-configured', path: '' };

  try {
    return await validateServiceAccount(credentialPath, {
      clientFactory: createChirpClient
    });
  } catch (error) {
    return {
      status: 'invalid',
      path: credentialPath,
      error: redactGoogleError(error)
    };
  }
}

ipcMain.handle('get-google-credentials-status', getGoogleCredentialsStatus);
ipcMain.handle('validate-google-credentials', getGoogleCredentialsStatus);

ipcMain.handle('clear-google-credentials', async () => {
  await credentialPathStore.clear();
  return { success: true };
});

ipcMain.handle('get-google-auth-status', async () => {
  try {
    const serializedAuth = await readEncryptedGoogleAuth();
    const value = JSON.parse(serializedAuth);
    return {
      connected: Boolean(
        value.refreshToken || (value.client_email && value.private_key)
      )
    };
  } catch {
    return { connected: false };
  }
});

// ============================================================================
// WHISPER ALIGNMENT & EXECUTION HANDLERS (v1.5)
// ============================================================================

const WHISPER_DIR = path.join(app.getPath('userData'), 'Whisper');
const WHISPER_ZIP = path.join(WHISPER_DIR, 'whisper.zip');
const WHISPER_EXE = path.join(WHISPER_DIR, 'Release', 'whisper-cli.exe');
const MODEL_DIR = path.join(WHISPER_DIR, 'models');
const MODEL_FILE = path.join(MODEL_DIR, 'ggml-base.bin');

function downloadFile(url, destPath, progressCallback) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath, progressCallback)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      const fileStream = fsSync.createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        fileStream.write(chunk);

        if (totalSize > 0 && progressCallback) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          progressCallback(percent);
        }
      });

      response.on('end', () => {
        fileStream.end();
        resolve();
      });

      response.on('error', (err) => {
        fileStream.end();
        reject(err);
      });
    }).on('error', reject);
  });
}

ipcMain.handle('setup-whisper', async (event) => {
  try {
    await fs.mkdir(WHISPER_DIR, { recursive: true });
    await fs.mkdir(MODEL_DIR, { recursive: true });

    let cliExists = false;
    try {
      await fs.access(WHISPER_EXE);
      cliExists = true;
    } catch {
      cliExists = false;
    }

    if (!cliExists) {
      event.sender.send('whisper-setup-progress', { status: 'downloading_cli', percent: 0 });

      const cliUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip';
      await downloadFile(cliUrl, WHISPER_ZIP, (percent) => {
        event.sender.send('whisper-setup-progress', { status: 'downloading_cli', percent });
      });

      event.sender.send('whisper-setup-progress', { status: 'extracting_cli', percent: 100 });

      const cmd = `powershell -Command "Expand-Archive -Path '${WHISPER_ZIP}' -DestinationPath '${WHISPER_DIR}' -Force"`;
      await new Promise((resolve, reject) => {
        exec(cmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        await fs.unlink(WHISPER_ZIP);
      } catch (e) { }
    }

    let modelExists = false;
    try {
      await fs.access(MODEL_FILE);
      modelExists = true;
    } catch {
      modelExists = false;
    }

    if (!modelExists) {
      event.sender.send('whisper-setup-progress', { status: 'downloading_model', percent: 0 });

      const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
      await downloadFile(modelUrl, MODEL_FILE, (percent) => {
        event.sender.send('whisper-setup-progress', { status: 'downloading_model', percent });
      });
    }

    event.sender.send('whisper-setup-progress', { status: 'ready', percent: 100 });
    return { success: true };

  } catch (err) {
    console.error('Setup Whisper error:', err);
    return { success: false, error: err.message || 'Lỗi tải Whisper.' };
  }
});

ipcMain.handle('check-whisper-setup', async () => {
  try {
    await fs.access(WHISPER_EXE);
    await fs.access(MODEL_FILE);
    return { ready: true };
  } catch {
    return { ready: false };
  }
});

async function runWhisperLogic(audioPath, useCloud) {
  try {
    let words = [];

    if (useCloud) {
      let openAiKey = '';
      try {
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const encrypted = await fs.readFile(OPENAI_KEY_FILE);
          openAiKey = safeStorage.decryptString(encrypted);
        } else {
          openAiKey = await fs.readFile(OPENAI_KEY_FILE, 'utf-8');
        }
      } catch {
        return { success: false, error: 'Chưa cấu hình OpenAI API Key trong Settings.' };
      }

      if (!openAiKey) {
        return { success: false, error: 'Chưa cấu hình OpenAI API Key trong Settings.' };
      }

      const fileData = fsSync.readFileSync(audioPath);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

      const filename = path.basename(audioPath);
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nword\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/mpeg\r\n\r\n`
      ];

      const payloadBuffer = Buffer.concat([
        Buffer.from(parts[0] + parts[1] + parts[2] + parts[3], 'utf-8'),
        fileData,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
      ]);

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: payloadBuffer
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message || `OpenAI API Error: ${response.status}` };
      }

      if (data.words) {
        words = data.words.map(w => ({
          word: w.word.trim(),
          start: w.start,
          end: w.end
        }));
      } else {
        return { success: false, error: 'API không trả về mốc thời gian từng từ.' };
      }

    } else {
      const wavPath = audioPath.replace(/\.mp3$/i, '_16k.wav');
      const jsonPath = wavPath + '.json';

      const convertCmd = `"${ffmpegStatic}" -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`;
      await new Promise((resolve, reject) => {
        exec(convertCmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const whisperCmd = `"${WHISPER_EXE}" -m "${MODEL_FILE}" -f "${wavPath}" -oj -ml 1`;
      await new Promise((resolve, reject) => {
        exec(whisperCmd, { cwd: path.join(WHISPER_DIR, 'Release') }, (err, stdout, stderr) => {
          if (err) {
            console.error('Whisper execution failed. Stderr:', stderr);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      try {
        const jsonContent = await fs.readFile(jsonPath, 'utf-8');
        const parsed = JSON.parse(jsonContent);

        if (parsed.transcription) {
          words = parsed.transcription.map(t => {
            const text = t.text.trim();
            const start = t.offsets.from / 1000;
            const end = t.offsets.to / 1000;
            return { word: text, start, end };
          });
        }
      } catch (e) {
        return { success: false, error: 'Lỗi đọc tệp kết quả từ Whisper local: ' + e.message };
      } finally {
        try {
          await fs.unlink(wavPath);
          await fs.unlink(jsonPath);
        } catch (e) { }
      }
    }

    if (words.length === 0) {
      return { success: false, error: 'Whisper không nhận diện được bất kỳ từ nào (V-6 / FR-2.5).' };
    }

    return { success: true, words };

  } catch (err) {
    console.error('Run Whisper error:', err);
    return { success: false, error: err.message || 'Lỗi chạy Whisper giải mã phụ đề.' };
  }
}

ipcMain.handle('run-whisper', async (_, { audioPath, useCloud }) => {
  return runWhisperLogic(audioPath, useCloud);
});

function formatSrtTime(seconds) {
  const ms = Math.floor((seconds % 1) * 1000);
  const secs = Math.floor(seconds % 60);
  const mins = Math.floor((seconds / 60) % 60);
  const hours = Math.floor(seconds / 3600);

  const pad = (n, len = 2) => n.toString().padStart(len, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

ipcMain.handle('generate-tts-srt', async (event, { text, prompt, model, languageCode, voiceName, outputPath, useCloud }) => {
  try {
    const ttsResult = await runTtsJob(event, {
      mode: 'expressive',
      text,
      prompt,
      modelName: model,
      languageCode,
      speaker: voiceName,
      voiceName,
      speakingRate: 1,
      outputPath,
      outputFormat: path.extname(outputPath).toLowerCase() === '.wav' ? 'wav' : 'mp3'
    });

    if (!ttsResult.success) {
      return { success: false, error: ttsResult.error || 'Lỗi khi tổng hợp giọng nói.' };
    }

    const durRes = await readAudioDuration(outputPath);
    if (!durRes.success || durRes.duration === undefined) {
      return { success: false, error: 'Không thể đọc thời lượng tệp audio để đối khớp.' };
    }
    const audioDuration = durRes.duration;

    const whisperResult = await runWhisperLogic(outputPath, useCloud);

    if (!whisperResult.success || !whisperResult.words) {
      return { success: false, error: whisperResult.error || 'Lỗi khi nhận diện giọng nói bằng Whisper.' };
    }

    const alignment = alignScriptAndWhisper(text, whisperResult.words, audioDuration);

    let srtContent = '';
    alignment.words.forEach((w, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${formatSrtTime(w.start)} --> ${formatSrtTime(w.end)}\n`;
      srtContent += `${w.word}\n\n`;
    });

    const srtPath = outputPath.replace(/\.mp3$/i, '.srt');
    await fs.writeFile(srtPath, srtContent, 'utf-8');

    return {
      success: true,
      mp3Path: outputPath,
      srtPath,
      matchRate: alignment.matchRate
    };

  } catch (err) {
    console.error('Generate TTS and SRT error:', err);
    return { success: false, error: err.message || 'Lỗi hệ thống khi tổng hợp giọng nói và phụ đề.' };
  }
});

ipcMain.handle('concat-and-align', async (event, { tempPaths, finalOutputPath, fullText, useCloud }) => {
  try {
    if (!tempPaths || tempPaths.length === 0) {
      return { success: false, error: 'Không có đoạn audio nào để ghép.' };
    }

    // 1. Ghép Audio với FFmpeg acrossfade
    if (tempPaths.length === 1) {
      if (tempPaths[0] !== finalOutputPath) {
        await fs.copyFile(tempPaths[0], finalOutputPath);
        await fs.unlink(tempPaths[0]).catch(() => { });
      }
    } else {
      let inputs = '';
      tempPaths.forEach(file => {
        inputs += `-i "${file}" `;
      });

      let filter = '';
      let lastOut = '[0:a]';
      for (let i = 1; i < tempPaths.length; i++) {
        const outLabel = `[a0${i}]`;
        filter += `${lastOut}[${i}:a]acrossfade=d=0.15:c1=tri:c2=tri${outLabel}`;
        if (i < tempPaths.length - 1) filter += ';';
        lastOut = outLabel;
      }

      const ffmpegCmd = `"${ffmpegStatic}" -y ${inputs}-filter_complex "${filter}" -map "${lastOut}" -c:a libmp3lame -b:a 256k "${finalOutputPath}"`;

      await new Promise((resolve, reject) => {
        exec(ffmpegCmd, { encoding: 'utf-8' }, (error, stdout, stderr) => {
          if (error) {
            console.error('FFmpeg concat error:', stderr);
            reject(new Error('Lỗi khi ghép file audio bằng FFmpeg.'));
          } else {
            resolve();
          }
        });
      });

      // Dọn dẹp file tạm
      for (const p of tempPaths) {
        await fs.unlink(p).catch(() => { });
      }
    }

    // 2. Đọc độ dài Audio
    const durRes = await readAudioDuration(finalOutputPath);
    if (!durRes.success || durRes.duration === undefined) {
      return { success: false, error: 'Không thể đọc thời lượng tệp audio đã ghép.' };
    }
    const audioDuration = durRes.duration;

    // 3. Chạy Whisper
    const whisperResult = await runWhisperLogic(finalOutputPath, useCloud);

    if (!whisperResult.success || !whisperResult.words) {
      return { success: false, error: whisperResult.error || 'Lỗi khi nhận diện giọng nói bằng Whisper.' };
    }

    // 4. Align Script và xuất SRT
    const alignment = alignScriptAndWhisper(fullText, whisperResult.words, audioDuration);
    const sentenceCues = groupWordsByScriptSentences(alignment.words, fullText);

    let srtContent = '';
    sentenceCues.forEach((w, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${formatSrtTime(w.start)} --> ${formatSrtTime(w.end)}\n`;
      srtContent += `${w.text || w.word}\n\n`;
    });

    const srtPath = finalOutputPath.replace(/\.mp3$/i, '.srt');
    await fs.writeFile(srtPath, srtContent, 'utf-8');

    return {
      success: true,
      mp3Path: finalOutputPath,
      srtPath,
      matchRate: alignment.matchRate
    };

  } catch (err) {
    console.error('Concat and Align error:', err);
    return { success: false, error: err.message || 'Lỗi hệ thống khi ghép audio và căn chỉnh phụ đề.' };
  }
});

function groupWordsIntoSentences(words, maxWords = 8, maxCharLength = 40, maxSilence = 1.0) {
  const sentences = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const wordText = w.word || w.original || '';
    const hasPunctuation = /[.!?]/.test(wordText);
    const isLastWord = i === words.length - 1;
    const nextWord = words[i + 1];
    const longSilence = nextWord ? (nextWord.start - w.end > maxSilence) : false;
    const charLength = currentWords.map(x => x.word || x.original || '').join(' ').length;

    if (hasPunctuation || isLastWord || longSilence || currentWords.length >= maxWords || charLength >= maxCharLength) {
      sentences.push({
        text: currentWords.map(x => x.word || x.original || '').join(' '),
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end
      });
      currentWords = [];
    }
  }
  return sentences;
}

ipcMain.handle('align-audio-and-script', async (event, { audioPath, scriptText, useCloud, transcribeOnly, srtLevel }) => {
  try {
    if (!audioPath) {
      return { success: false, error: 'Đường dẫn tệp audio không hợp lệ.' };
    }
    if (!transcribeOnly && (!scriptText || !scriptText.trim())) {
      return { success: false, error: 'Văn bản kịch bản trống.' };
    }

    // 1. Kiểm tra file audio tồn tại
    try {
      await fs.access(audioPath);
    } catch {
      return { success: false, error: 'Không tìm thấy tệp audio tại đường dẫn đã cung cấp.' };
    }

    // 2. Đọc độ dài Audio
    const durRes = await readAudioDuration(audioPath);
    if (!durRes.success || durRes.duration === undefined) {
      return { success: false, error: 'Không thể đọc thời lượng tệp audio.' };
    }
    const audioDuration = durRes.duration;

    // 3. Chạy giải mã Whisper
    const whisperResult = await runWhisperLogic(audioPath, useCloud);
    if (!whisperResult.success || !whisperResult.words) {
      return { success: false, error: whisperResult.error || 'Lỗi khi nhận diện giọng nói bằng Whisper.' };
    }

    let finalCues = [];
    let matchRate = 100;

    if (transcribeOnly) {
      // Chế độ không dùng script: Lấy trực tiếp kết quả từ Whisper
      finalCues = whisperResult.words;
    } else {
      // Chế độ dùng script: Căn lề kịch bản với Whisper
      const alignment = alignScriptAndWhisper(scriptText.trim(), whisperResult.words, audioDuration);
      finalCues = alignment.words;
      matchRate = alignment.matchRate;
    }

    // Gộp câu nếu srtLevel là 'sentence'
    if (srtLevel === 'sentence') {
      if (!transcribeOnly && scriptText && scriptText.trim()) {
        finalCues = groupWordsByScriptSentences(finalCues, scriptText.trim());
      } else {
        finalCues = groupWordsIntoSentences(finalCues);
      }
    }

    // Tạo nội dung file SRT
    let srtContent = '';
    finalCues.forEach((cue, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n`;
      srtContent += `${cue.word || cue.text}\n\n`;
    });

    // Tạo file SRT & TXT tạm
    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const srtPath = path.join(tempDir, `aligned_${timestamp}.srt`);
    await fs.writeFile(srtPath, srtContent, 'utf-8');

    const txtContent = srtToTimestampText(srtContent);
    const txtPath = path.join(tempDir, `aligned_${timestamp}.txt`);
    await fs.writeFile(txtPath, txtContent, 'utf-8');

    return {
      success: true,
      srtPath,
      srtContent,
      txtPath,
      txtContent,
      matchRate
    };

  } catch (err) {
    console.error('Align audio and script error:', err);
    return { success: false, error: err.message || 'Lỗi hệ thống khi căn lề phụ đề.' };
  }
});

ipcMain.handle('get-video-duration', async (_, filePath) => {
  try {
    return { success: true, duration: await getVideoDuration(filePath) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('convert-to-vertical', async (event, params) => {
  try {
    const reportProgress = (progressData) => event.sender.send('vertical-convert-progress', progressData);
    if (params.splitConfig?.enabled) {
      return await convertToVerticalBatch({
        ...params,
        outputDirectory: params.splitConfig.outputDirectory,
        outputBaseName: params.splitConfig.outputBaseName,
        splitPoints: params.splitConfig.splitPoints,
        overlapSeconds: params.splitConfig.overlapSeconds
      }, reportProgress);
    }
    return await convertToVertical(params, reportProgress);
  } catch (error) {
    return { success: false, outputPaths: [], error: error.message };
  }
});

ipcMain.handle('cancel-vertical-convert', async () => {
  return cancelVerticalBatch();
});

ipcMain.handle('validate-srt', async (_, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const timeRegex = /^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}$/;
    const errors = [];
    
    if (!content.trim()) {
      return { valid: false, errorCount: 1, errors: ['Tệp phụ đề trống.'] };
    }

    const blocks = content.split(/\r?\n\r?\n/).filter(Boolean);
    let index = 1;
    for (const block of blocks) {
      const blockLines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (blockLines.length < 2) {
        errors.push(`Đoạn số ${index}: Thiếu mốc thời gian hoặc nội dung chữ.`);
        index++;
        continue;
      }
      
      const seq = parseInt(blockLines[0], 10);
      if (isNaN(seq)) {
        errors.push(`Đoạn số ${index}: Dòng đầu tiên phải là số thứ tự (nhận được: "${blockLines[0]}").`);
      }

      const timeLine = blockLines[1];
      if (!timeRegex.test(timeLine)) {
        errors.push(`Đoạn số ${index}: Sai định dạng mốc thời gian (nhận được: "${timeLine}"). Định dạng chuẩn là: "00:00:00,000 --> 00:00:00,000"`);
      }
      index++;
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors: errors.slice(0, 3), // Trả về tối đa 3 lỗi đầu để tránh rối giao diện
        errorCount: errors.length
      };
    }
    return { valid: true, errorCount: 0, errors: [] };
  } catch (err) {
    return { valid: false, errorCount: 1, errors: [`Không thể đọc file: ${err.message}`] };
  }
});

ipcMain.handle('concat-audio-only', async (event, { tempPaths, finalOutputPath }) => {
  try {
    if (!tempPaths || tempPaths.length === 0) {
      return { success: false, error: 'Không có đoạn audio nào để ghép.' };
    }

    if (tempPaths.length === 1) {
      if (tempPaths[0] !== finalOutputPath) {
        await fs.copyFile(tempPaths[0], finalOutputPath);
        await fs.unlink(tempPaths[0]).catch(() => { });
      }
    } else {
      let inputs = '';
      tempPaths.forEach(file => {
        inputs += `-i "${file}" `;
      });

      let filter = '';
      let lastOut = '[0:a]';
      for (let i = 1; i < tempPaths.length; i++) {
        const outLabel = `[a0${i}]`;
        filter += `${lastOut}[${i}:a]acrossfade=d=0.15:c1=tri:c2=tri${outLabel}`;
        if (i < tempPaths.length - 1) filter += ';';
        lastOut = outLabel;
      }

      const ffmpegCmd = `"${ffmpegStatic}" -y ${inputs}-filter_complex "${filter}" -map "${lastOut}" -c:a libmp3lame -b:a 256k "${finalOutputPath}"`;

      await new Promise((resolve, reject) => {
        exec(ffmpegCmd, { encoding: 'utf-8' }, (error, stdout, stderr) => {
          if (error) {
            console.error('FFmpeg concat error:', stderr);
            reject(new Error('Lỗi khi ghép file audio bằng FFmpeg.'));
          } else {
            resolve();
          }
        });
      });

      // Dọn dẹp file tạm
      for (const p of tempPaths) {
        await fs.unlink(p).catch(() => { });
      }
    }

    return {
      success: true,
      audioPath: finalOutputPath
    };
  } catch (err) {
    console.error('Concat audio only error:', err);
    return { success: false, error: err.message || 'Lỗi hệ thống khi ghép audio.' };
  }
});

ipcMain.handle('translate-segments', async (_, params) => {
  try {
    const translatedSegments = await translateSegments(params);
    return { success: true, segments: translatedSegments };
  } catch (err) {
    console.error('Translate segments error:', err);
    return { success: false, error: err.message || 'Lỗi khi dịch thuật kịch bản.' };
  }
});

ipcMain.handle('render-reup-video', async (_, params) => {
  try {
    const args = buildReupFFmpegArgs(params);
    await new Promise((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpegStatic, args);
      ffmpegProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg reup render exited with code ${code}`));
      });
      ffmpegProcess.on('error', reject);
    });

    return { success: true, outputPath: params.outputPath };
  } catch (err) {
    console.error('Render reup video error:', err);
    return { success: false, error: err.message || 'Lỗi hệ thống khi render video reup.' };
  }
});
