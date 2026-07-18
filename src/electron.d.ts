declare global {
  interface StoryboardFile {
    path: string;
    name: string;
    mm: number;
    ss: number;
    index: number;
    startTime: number; // in seconds
    duration: number;  // in seconds
    isAutoFixed: boolean;
    sfxPath?: string | null;
    sfxName?: string | null;
    kbZoomDirection?: 'in' | 'out' | null;
    kbZoomLimit?: number | null;
    kbPanAnchor?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
  }

  interface SkippedFile {
    name: string;
    reason: string;
  }

  interface ImportResult {
    success: boolean;
    directoryPath?: string;
    files?: StoryboardFile[];
    skipped?: SkippedFile[];
    lastImageStartTime?: number;
    error?: string;
  }

  interface RenderSettings {
    directoryPath: string;
    resolution: string; // e.g., "1920x1080"
    bitrateMbps: number;
    fps: number;
    resizeMode: "fit" | "fill" | "stretch";
    totalDuration: number;
    files: StoryboardFile[];
    outputPath: string;
    voiceAudioPath?: string | null;
    voiceVolumeDb: number;
    sfxVolumeDb: number;
    transitionEnabled: boolean;
    transitionType: 'dissolve' | 'fade_black';
    transitionDuration: number;
    kenBurnsEnabled: boolean;
    preset?: 'draft' | 'standard' | 'high' | '4k' | 'custom';
    verticalExportEnabled?: boolean;
    videoTitle?: string;
    verticalSrtPath?: string;
    verticalTitleFontSize?: number;
    verticalSubtitleFontSize?: number;
    verticalTitleColor?: string;
    verticalSubtitleColor?: string;
    verticalTitleYPercent?: number;
    verticalSubtitleMarginV?: number;
    verticalSplitConfig?: {
      enabled: boolean;
      splitPoints: number[];
      overlapSeconds: number;
    };
  }

  interface RenderProgress {
    progress: number;
    eta: string;
    currentFrame?: number;
    totalFrames?: number;
    segmentIndex?: number;
    segmentCount?: number;
  }

  interface RenderResult {
    success: boolean;
    error?: string;
    videoPath?: string;
    sizeBytes?: number;
    duration?: number;
    verticalVideoPaths?: string[];
    verticalError?: string;
  }

  interface ProjectMetadata {
    project_id: string;
    project_name: string;
    created_at: number;
    updated_at: number;
    thumbnail_path: string | null;
    totalDuration: number;
    filesCount: number;
  }

  interface ProjectData {
    version: number;
    project_id: string;
    project_name: string;
    created_at: number;
    updated_at: number;
    thumbnail_path: string | null;
    directoryPath: string | null;
    totalDuration: number;
    voiceAudio: { path: string; name: string; duration: number } | null;
    sfxPool: { path: string; name: string; duration: number }[];
    voiceVolume: number;
    sfxVolume: number;
    transitionEnabled: boolean;
    transitionType: 'dissolve' | 'fade_black';
    transitionDuration: number;
    kenBurnsEnabled: boolean;
    exportConfig: {
      preset: 'draft' | 'standard' | 'high' | '4k' | 'custom';
      resolution: string;
      bitrateMbps: number;
      fps: number;
      resizeMode: 'fit' | 'fill' | 'stretch';
      outputPath: string;
    };
    files: StoryboardFile[];
    video_title?: string;
    vertical_export_enabled?: boolean;
    vertical_srt_path?: string;
    vertical_title_font_size?: number;
    vertical_subtitle_font_size?: number;
    vertical_title_color?: string;
    vertical_subtitle_color?: string;
    vertical_title_y_percent?: number;
    vertical_subtitle_margin_v?: number;
    vertical_split_enabled?: boolean;
    vertical_split_points?: number[];
    vertical_overlap_seconds?: number;
  }

  type TtsMode = 'stable' | 'expressive';
  type TtsEngine = 'chirp-streaming' | 'chirp-rest' | 'neural2-rest' | 'gemini-rest';

  interface TtsJobRequest {
    mode: TtsMode;
    text: string;
    prompt?: string;
    modelName?: string;
    languageCode: string;
    speaker: string;
    voiceName: string;
    speakingRate: number;
    outputPath: string;
    outputFormat: 'wav' | 'mp3';
  }

  interface TtsJobResult {
    success: boolean;
    cancelled?: boolean;
    outputPath?: string;
    engine?: TtsEngine;
    modelName?: string;
    voiceName?: string;
    fallbackReason?: string;
    error?: string;
  }

  interface TtsJobProgress {
    phase: 'validating' | 'streaming' | 'synthesizing' | 'retrying' | 'fallback' | 'encoding';
    progress: number;
    engine: TtsEngine;
    message?: string;
  }

  interface GoogleAuthStatus {
    connected: boolean;
  }

  interface GoogleCredentialsStatus {
    status: 'valid' | 'invalid' | 'not-configured';
    path: string;
    error?: string;
  }

  interface ElectronAPI {
    selectDirectory: () => Promise<ImportResult | null>;
    renderVideo: (settings: RenderSettings) => Promise<{ success: boolean; error?: string }>;
    cancelRender: () => Promise<void>;
    openDirectory: (filePath: string) => Promise<void>;
    playVideo: (filePath: string) => Promise<void>;
    selectSavePath: (defaultPath?: string) => Promise<string | null>;
    readAudioDuration: (filePath: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
    selectAudioFile: () => Promise<{ path: string; name: string } | null>;
    selectVideoFile: () => Promise<{ path: string; name: string } | null>;
    selectSfxFiles: () => Promise<{ path: string; name: string }[] | null>;
    
    // Project management APIs
    saveProject: (project: ProjectData) => Promise<{ success: boolean; project?: ProjectData; error?: string }>;
    getProjectList: () => Promise<ProjectMetadata[]>;
    loadProject: (projectId: string) => Promise<{ success: boolean; project?: ProjectData; error?: string }>;
    deleteProject: (projectId: string) => Promise<{ success: boolean; error?: string }>;
    duplicateProject: (projectId: string) => Promise<{ success: boolean; project?: ProjectData; error?: string }>;
    checkFilesExist: (paths: string[]) => Promise<string[]>;
    selectExportDirectory: () => Promise<string | null>;
    selectRelinkFile: (extensions: string[]) => Promise<{ path: string; name: string } | null>;

    // API Key & TTS APIs
    saveApiKey: (service: 'google' | 'openai', key: string) => Promise<{ success: boolean; error?: string }>;
    getApiKey: (service: 'openai') => Promise<{ success: boolean; key: string; error?: string }>;
    deleteApiKey: (service: 'google' | 'openai') => Promise<{ success: boolean; error?: string }>;
    startGoogleOAuth: (clientId: string, clientSecret: string) => Promise<{ success: boolean; error?: string }>;
    synthesizeSpeech: (request: TtsJobRequest) => Promise<TtsJobResult>;
    cancelTtsJob: () => Promise<{ success: boolean }>;
    onTtsJobProgress: (callback: (payload: TtsJobProgress) => void) => () => void;
    getGoogleAuthStatus: () => Promise<GoogleAuthStatus>;
    selectGoogleCredentialsFile: () => Promise<GoogleCredentialsStatus>;
    getGoogleCredentialsStatus: () => Promise<GoogleCredentialsStatus>;
    validateGoogleCredentials: () => Promise<GoogleCredentialsStatus>;
    clearGoogleCredentials: () => Promise<{ success: boolean }>;
    concatAudioOnly: (params: {
      tempPaths: string[];
      finalOutputPath: string;
    }) => Promise<{ success: boolean; audioPath?: string; error?: string }>;
    alignAudioAndScript: (params: {
      audioPath: string;
      scriptText: string;
      useCloud: boolean;
      transcribeOnly: boolean;
      srtLevel: 'word' | 'sentence';
      splitExtendedPunctuation?: boolean;
    }) => Promise<{ success: boolean; srtPath?: string; srtContent?: string; matchRate?: number; error?: string }>;
    mapScriptToSrt: (params: {
      scriptText: string;
      srtPath?: string;
      srtContent?: string;
      includeMs?: boolean;
    }) => Promise<{ success: boolean; formattedText?: string; error?: string }>;
    convertToVertical: (params: {
      sourceVideoPath: string;
      outputPath: string;
      title: string;
      srtPath: string;
      qualityPreset: 'draft' | 'standard' | 'high' | '4k' | 'custom';
      titleFontSize?: number;
      subtitleFontSize?: number;
      titleColor?: string;
      subtitleColor?: string;
      titleYPercent?: number;
      subtitleMarginV?: number;
      splitConfig?: {
        enabled: boolean;
        splitPoints: number[];
        overlapSeconds: number;
        outputDirectory?: string;
        outputBaseName?: string;
      };
    }) => Promise<{ success: boolean; outputPaths?: string[]; error?: string }>;
    validateSrt: (filePath: string) => Promise<{ valid: boolean; errorCount: number; errors: string[] }>;
    cancelVerticalConvert: () => Promise<boolean>;
    getVideoDuration: (filePath: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
    translateSegments: (params: {
      segments: { id: number; start: number; end: number; text: string }[];
      sourceLang: string;
      targetLang: string;
      provider: 'gemini' | 'openai' | 'deepseek';
      apiKey: string;
      endpointUrl?: string;
    }) => Promise<{ success: boolean; segments?: { id: number; start: number; end: number; original: string; translated: string }[]; error?: string }>;
    renderReupVideo: (params: any) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
    extractVideoSpeech: (params: { videoPath: string; useCloud: boolean }) => Promise<{ success: boolean; segments?: any[]; error?: string }>;
    generateReupVoiceover: (params: {
      segments: any[];
      targetLang: string;
      voiceName: string;
    }) => Promise<{ success: boolean; voiceoverSegments?: { path: string; start: number }[]; error?: string }>;

    // Whisper APIs
    setupWhisper: () => Promise<{ success: boolean; error?: string }>;
    checkWhisperSetup: () => Promise<{ ready: boolean }>;
    runWhisper: (params: {
      audioPath: string;
      useCloud: boolean;
    }) => Promise<{ success: boolean; words?: { word: string; start: number; end: number }[]; error?: string }>;
    onWhisperSetupProgress: (callback: (payload: { status: 'downloading_cli' | 'extracting_cli' | 'downloading_model' | 'ready'; percent: number }) => void) => () => void;
    generateTtsAndSrt: (params: {
      text: string;
      prompt?: string;
      model: string;
      languageCode: string;
      voiceName: string;
      outputPath: string;
      useCloud: boolean;
    }) => Promise<{ success: boolean; mp3Path?: string; srtPath?: string; matchRate?: number; error?: string }>;

    // Batch Export APIs
    startBatchRender: (projectIds: string[], outputDir: string) => Promise<{ success: boolean }>;
    cancelBatchExport: () => Promise<void>;
    onBatchProjectStart: (callback: (payload: { projectId: string }) => void) => () => void;
    onBatchProjectProgress: (callback: (payload: { projectId: string; progress: number; eta: string }) => void) => () => void;
    onBatchProjectComplete: (callback: (payload: { projectId: string; success: boolean; videoPath?: string; error?: string }) => void) => () => void;

    onRenderProgress: (callback: (payload: RenderProgress) => void) => () => void;
    onRenderComplete: (callback: (payload: RenderResult) => void) => () => void;
    onVerticalConvertProgress: (callback: (payload: { progress: number; eta: string }) => void) => () => void;
    onReupRenderProgress: (callback: (payload: { progress: number; eta: string }) => void) => () => void;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
