const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  renderVideo: (settings) => ipcRenderer.invoke('render-video', settings),
  cancelRender: () => ipcRenderer.invoke('cancel-render'),
  openDirectory: (filePath) => ipcRenderer.invoke('open-directory', filePath),
  playVideo: (filePath) => ipcRenderer.invoke('play-video', filePath),
  selectSavePath: (defaultPath) => ipcRenderer.invoke('select-save-path', defaultPath),
  getTempPath: () => ipcRenderer.invoke('get-temp-path'),
  saveFileFromTemp: (params) => ipcRenderer.invoke('save-file-from-temp', params),
  readAudioDuration: (filePath) => ipcRenderer.invoke('read-audio-duration', filePath),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  selectSfxFiles: () => ipcRenderer.invoke('select-sfx-files'),
  
  // Project management APIs
  saveProject: (project) => ipcRenderer.invoke('save-project', project),
  getProjectList: () => ipcRenderer.invoke('get-project-list'),
  loadProject: (projectId) => ipcRenderer.invoke('load-project', projectId),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  duplicateProject: (projectId) => ipcRenderer.invoke('duplicate-project', projectId),
  checkFilesExist: (paths) => ipcRenderer.invoke('check-files-exist', paths),
  selectExportDirectory: () => ipcRenderer.invoke('select-export-directory'),
  selectRelinkFile: (extensions) => ipcRenderer.invoke('select-relink-file', extensions),
  
  saveApiKey: (service, key) => ipcRenderer.invoke('save-api-key', { service, key }),
  getApiKey: (service) => ipcRenderer.invoke('get-api-key', { service }),
  deleteApiKey: (service) => ipcRenderer.invoke('delete-api-key', { service }),
  startGoogleOAuth: (clientId, clientSecret) => ipcRenderer.invoke('start-google-oauth', { clientId, clientSecret }),
  synthesizeSpeech: (params) => ipcRenderer.invoke('synthesize-speech', params),
  cancelTtsJob: () => ipcRenderer.invoke('cancel-tts-job'),
  onTtsJobProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('tts-job-progress', listener);
    return () => ipcRenderer.removeListener('tts-job-progress', listener);
  },
  selectGoogleCredentialsFile: () => ipcRenderer.invoke('select-google-credentials-file'),
  getGoogleCredentialsStatus: () => ipcRenderer.invoke('get-google-credentials-status'),
  validateGoogleCredentials: () => ipcRenderer.invoke('validate-google-credentials'),
  clearGoogleCredentials: () => ipcRenderer.invoke('clear-google-credentials'),
  getGoogleAuthStatus: () => ipcRenderer.invoke('get-google-auth-status'),
  generateTtsAndSrt: (params) => ipcRenderer.invoke('generate-tts-srt', params),
  concatAndAlign: (params) => ipcRenderer.invoke('concat-and-align', params),
  concatAudioOnly: (params) => ipcRenderer.invoke('concat-audio-only', params),
  alignAudioAndScript: (params) => ipcRenderer.invoke('align-audio-and-script', params),
  convertToVertical: (params) => ipcRenderer.invoke('convert-to-vertical', params),
  validateSrt: (filePath) => ipcRenderer.invoke('validate-srt', filePath),
  cancelVerticalConvert: () => ipcRenderer.invoke('cancel-vertical-convert'),
  getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
  translateSegments: (params) => ipcRenderer.invoke('translate-segments', params),
  renderReupVideo: (params) => ipcRenderer.invoke('render-reup-video', params),
  
  setupWhisper: () => ipcRenderer.invoke('setup-whisper'),
  checkWhisperSetup: () => ipcRenderer.invoke('check-whisper-setup'),
  runWhisper: (params) => ipcRenderer.invoke('run-whisper', params),
  onWhisperSetupProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('whisper-setup-progress', listener);
    return () => ipcRenderer.removeListener('whisper-setup-progress', listener);
  },
  
  startBatchRender: (projectIds, outputDir) => ipcRenderer.invoke('start-batch-render', { projectIds, outputDir }),
  cancelBatchExport: () => ipcRenderer.invoke('cancel-batch-export'),
  
  onBatchProjectStart: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('batch-project-start', listener);
    return () => ipcRenderer.removeListener('batch-project-start', listener);
  },
  onBatchProjectProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('batch-project-progress', listener);
    return () => ipcRenderer.removeListener('batch-project-progress', listener);
  },
  onBatchProjectComplete: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('batch-project-complete', listener);
    return () => ipcRenderer.removeListener('batch-project-complete', listener);
  },

  onRenderProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('render-progress', listener);
    return () => ipcRenderer.removeListener('render-progress', listener);
  },
  onRenderComplete: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('render-complete', listener);
    return () => ipcRenderer.removeListener('render-complete', listener);
  },
  onVerticalConvertProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('vertical-convert-progress', listener);
    return () => ipcRenderer.removeListener('vertical-convert-progress', listener);
  }
});
