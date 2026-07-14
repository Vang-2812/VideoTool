import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { assignRandomSfx, assignKenBurns, reshuffleKenBurns } from '../utils/sfxRandomizer.js';

export type Step = 'dashboard' | 'import' | 'preview' | 'settings' | 'rendering' | 'complete' | 'batch_progress';

export interface ExportConfig {
  preset: 'draft' | 'standard' | 'high' | '4k' | 'custom';
  resolution: string;
  bitrateMbps: number;
  fps: number;
  resizeMode: 'fit' | 'fill' | 'stretch';
  outputPath: string;
}

interface ProjectContextType {
  step: Step;
  directoryPath: string | null;
  files: StoryboardFile[];
  skipped: SkippedFile[];
  lastImageStartTime: number;
  totalDuration: number;
  exportConfig: ExportConfig;
  renderProgress: RenderProgress & { error?: string };
  renderResult: RenderResult | null;
  
  // Audio state
  voiceAudio: { path: string; name: string; duration: number } | null;
  sfxPool: { path: string; name: string; duration: number }[];
  
  // v1.3 States
  voiceVolume: number;
  sfxVolume: number;
  transitionEnabled: boolean;
  transitionType: 'dissolve' | 'fade_black';
  transitionDuration: number;
  kenBurnsEnabled: boolean;

  // v1.4 States
  projectId: string | null;
  projectName: string | null;
  isUnsaved: boolean;
  projectsList: ProjectMetadata[];
  missingFiles: string[];
  tempProjectData: ProjectData | null;
  
  setStep: (step: Step) => void;
  importDirectory: () => Promise<boolean>;
  setTotalDuration: (duration: number) => void;
  updateExportConfig: (config: Partial<ExportConfig>) => void;
  startRender: () => Promise<boolean>;
  cancelRender: () => Promise<void>;
  resetProject: () => void;
  setFiles: React.Dispatch<React.SetStateAction<StoryboardFile[]>>;
  
  // Audio actions
  addVoiceAudio: (filePath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  removeVoiceAudio: () => void;
  addSfxFile: (filePath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  addSfxFiles: (selectedFiles: { path: string; name: string }[]) => Promise<{ 
    success: boolean; 
    addedCount: number; 
    skipped: string[]; 
    duplicates: string[];
    error?: string;
  }>;
  removeSfxFile: (filePath: string) => void;
  reShuffleSfx: () => void;

  // v1.3 Actions
  setVoiceVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setTransitionEnabled: (enabled: boolean) => void;
  setTransitionType: (type: 'dissolve' | 'fade_black') => void;
  setTransitionDuration: (duration: number) => void;
  setKenBurnsEnabled: (enabled: boolean) => void;
  reShuffleKenBurns: () => void;

  // v1.4 Actions
  saveProject: (customName?: string) => Promise<{ success: boolean; error?: string }>;
  saveProjectAs: (newName: string) => Promise<{ success: boolean; error?: string }>;
  loadProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  duplicateProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  refreshProjectsList: () => Promise<void>;
  createNewProject: () => void;
  relinkFile: (oldPath: string, newPath: string) => Promise<void>;
  ignoreMissingFiles: () => Promise<void>;
  cancelRelinking: () => void;
  markAsDirty: () => void;
  deleteFile: (filePath: string) => void;
  cascadeShift: (index: number, direction: 'forward' | 'backward') => void;
  
  // v1.8 Vertical Export States
  videoTitle: string;
  verticalExportEnabled: boolean;
  verticalSrtPath: string;
  verticalTitleFontSize: number;
  verticalSubtitleFontSize: number;
  verticalTitleColor: string;
  verticalSubtitleColor: string;
  verticalTitleYPercent: number;
  verticalSubtitleMarginV: number;
  verticalSplitEnabled: boolean;
  verticalSplitPoints: number[];
  verticalOverlapSeconds: number;
  setVideoTitle: (title: string) => void;
  setVerticalExportEnabled: (enabled: boolean) => void;
  setVerticalSrtPath: (path: string) => void;
  setVerticalTitleFontSize: (size: number) => void;
  setVerticalSubtitleFontSize: (size: number) => void;
  setVerticalTitleColor: (color: string) => void;
  setVerticalSubtitleColor: (color: string) => void;
  setVerticalTitleYPercent: (percent: number) => void;
  setVerticalSubtitleMarginV: (margin: number) => void;
  setVerticalSplitEnabled: (enabled: boolean) => void;
  setVerticalSplitPoints: (points: number[]) => void;
  setVerticalOverlapSeconds: (seconds: number) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const PRESET_MAP = {
  draft: { resolution: '1280x720', bitrateMbps: 2.5 },
  standard: { resolution: '1920x1080', bitrateMbps: 6.0 },
  high: { resolution: '1920x1080', bitrateMbps: 12.0 },
  '4k': { resolution: '3840x2160', bitrateMbps: 35.0 },
  custom: { resolution: '1920x1080', bitrateMbps: 6.0 }
};

// Initial calculation when importing
function calculateTimelineFront(filesList: StoryboardFile[], durationVal: number, minDuration = 0.5) {
  const n = filesList.length;
  if (n === 0) return [];

  const result = filesList.map(f => ({
    ...f,
    duration: 0,
    isAutoFixed: false
  }));

  if (n === 1) {
    result[0].duration = durationVal;
    return result;
  }

  for (let i = 0; i < n - 1; i++) {
    result[i].duration = result[i + 1].startTime - result[i].startTime;
  }
  result[n - 1].duration = Math.max(minDuration, durationVal - result[n - 1].startTime);

  let carryDeduction = 0;
  for (let i = 0; i < n; i++) {
    if (carryDeduction > 0) {
      const available = result[i].duration;
      const maxDeductible = Math.max(0, available - minDuration);
      
      if (maxDeductible >= carryDeduction) {
        result[i].duration -= carryDeduction;
        carryDeduction = 0;
      } else {
        result[i].duration -= maxDeductible;
        carryDeduction -= maxDeductible;
      }
    }

    if (result[i].duration < minDuration) {
      const boost = minDuration - result[i].duration;
      result[i].duration = minDuration;
      result[i].isAutoFixed = true;
      carryDeduction += boost;
    }
  }

  return result;
}

export function recalculateStartTimes(filesList: StoryboardFile[]) {
  const result = [...filesList];
  let currentStart = 0;
  for (let i = 0; i < result.length; i++) {
    result[i] = { ...result[i], startTime: currentStart };
    currentStart += result[i].duration;
  }
  return { updatedFiles: result, newTotalDuration: currentStart };
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [step, setStep] = useState<Step>('dashboard'); // v1.4 default entry point
  const [directoryPath, setDirectoryPath] = useState<string | null>(null);
  const [files, setFiles] = useState<StoryboardFile[]>([]);
  const [skipped, setSkipped] = useState<SkippedFile[]>([]);
  const [lastImageStartTime, setLastImageStartTime] = useState<number>(0);
  const [totalDuration, setTotalDurationState] = useState<number>(0);
  
  // Audio state
  const [voiceAudio, setVoiceAudio] = useState<{ path: string; name: string; duration: number } | null>(null);
  const [sfxPool, setSfxPool] = useState<{ path: string; name: string; duration: number }[]>([]);
  const [lastManualDuration, setLastManualDuration] = useState<number>(0);

  // v1.3 Audio Volumes (Db)
  const [voiceVolume, setVoiceVolume] = useState<number>(0); // 0dB default
  const [sfxVolume, setSfxVolume] = useState<number>(-12); // -12dB default

  // v1.3 Transition
  const [transitionEnabled, setTransitionEnabled] = useState<boolean>(false);
  const [transitionType, setTransitionType] = useState<'dissolve' | 'fade_black'>('dissolve');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.5);

  // v1.3 Ken Burns
  const [kenBurnsEnabled, setKenBurnsEnabled] = useState<boolean>(false);

  // v1.4 States
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number>(Date.now());
  const [isUnsaved, setIsUnsaved] = useState<boolean>(false);
  const [projectsList, setProjectsList] = useState<ProjectMetadata[]>([]);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [tempProjectData, setTempProjectData] = useState<ProjectData | null>(null);

  // v1.8 Vertical Export States
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [verticalExportEnabled, setVerticalExportEnabled] = useState<boolean>(false);
  const [verticalSrtPath, setVerticalSrtPath] = useState<string>('');
  const [verticalTitleFontSize, setVerticalTitleFontSize] = useState<number>(48);
  const [verticalSubtitleFontSize, setVerticalSubtitleFontSize] = useState<number>(54);
  const [verticalTitleColor, setVerticalTitleColor] = useState<string>('#FFFFFF');
  const [verticalSubtitleColor, setVerticalSubtitleColor] = useState<string>('#FFFF00');
  const [verticalTitleYPercent, setVerticalTitleYPercent] = useState<number>(7.5);
  const [verticalSubtitleMarginV, setVerticalSubtitleMarginV] = useState<number>(180);
  const [verticalSplitEnabled, setVerticalSplitEnabled] = useState<boolean>(false);
  const [verticalSplitPoints, setVerticalSplitPoints] = useState<number[]>([]);
  const [verticalOverlapSeconds, setVerticalOverlapSeconds] = useState<number>(5);

  // No longer useMemo for timelineFiles, files state IS the timelineFiles in v1.6

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    preset: 'standard',
    resolution: '1920x1080',
    bitrateMbps: 6.0,
    fps: 30,
    resizeMode: 'fit',
    outputPath: ''
  });

  const [renderProgress, setRenderProgress] = useState<RenderProgress & { error?: string }>({
    progress: 0,
    eta: '--:--',
    error: undefined
  });

  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);

  // Setup default output file path when directory changes
  useEffect(() => {
    if (directoryPath) {
      const defaultOutput = `${directoryPath}\\output_video.mp4`;
      setExportConfig(prev => ({ ...prev, outputPath: defaultOutput }));
    }
  }, [directoryPath]);

  // IPC Event listeners for rendering progress
  useEffect(() => {
    let unsubProgress: (() => void) | null = null;
    let unsubComplete: (() => void) | null = null;

    if (step === 'rendering') {
      setRenderProgress({ progress: 0, eta: 'Calculating...', error: undefined });
      
      unsubProgress = window.electronAPI.onRenderProgress((data) => {
        setRenderProgress({
          progress: data.progress,
          eta: data.eta,
          currentFrame: data.currentFrame,
          totalFrames: data.totalFrames,
          segmentIndex: data.segmentIndex,
          segmentCount: data.segmentCount
        });
      });

      unsubComplete = window.electronAPI.onRenderComplete((data) => {
        if (data.success) {
          setRenderResult(data);
          setStep('complete');
        } else {
          setRenderProgress(prev => ({ ...prev, error: data.error || 'Quá trình render thất bại.' }));
        }
      });
    }

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubComplete) unsubComplete();
    };
  }, [step]);

  // Fetch initial project list
  useEffect(() => {
    refreshProjectsList();
  }, []);

  const markAsDirty = () => {
    setIsUnsaved(true);
  };

  const importDirectory = async () => {
    try {
      const res = await window.electronAPI.selectDirectory();
      if (res && res.success) {
        setDirectoryPath(res.directoryPath || null);
        setSkipped(res.skipped || []);
        setLastImageStartTime(res.lastImageStartTime || 0);
        
        // Auto-assign SFX from existing pool if files exist
        const initialFiles = res.files || [];
        let assigned = assignRandomSfx(initialFiles, sfxPool);
        
        // Auto-assign Ken Burns if enabled
        if (kenBurnsEnabled) {
          assigned = assignKenBurns(assigned);
        }

        // Handle totalDuration override
        let suggestedDuration = (res.lastImageStartTime || 0) + 10;
        if (voiceAudio) {
          suggestedDuration = voiceAudio.duration;
        }
        
        const initializedFiles = calculateTimelineFront(assigned, suggestedDuration);
        setFiles(initializedFiles);
        setTotalDurationState(suggestedDuration);
        
        setIsUnsaved(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Import directory failed:', err);
      return false;
    }
  };

  const setTotalDuration = (duration: number) => {
    if (!voiceAudio) {
      setTotalDurationState(duration);
      setLastManualDuration(duration);
      setIsUnsaved(true);
      
      // Update last file's duration to match the new totalDuration
      setFiles(prev => {
        if (prev.length === 0) return prev;
        const newFiles = [...prev];
        const lastIdx = newFiles.length - 1;
        newFiles[lastIdx].duration = Math.max(0.5, duration - newFiles[lastIdx].startTime);
        return newFiles;
      });
    }
  };

  const updateExportConfig = (config: Partial<ExportConfig>) => {
    setExportConfig(prev => {
      const next = { ...prev, ...config };
      if (config.preset && config.preset !== 'custom') {
        const presets = PRESET_MAP[config.preset];
        next.resolution = presets.resolution;
        next.bitrateMbps = presets.bitrateMbps;
      } else if (config.resolution || config.bitrateMbps) {
        next.preset = 'custom';
      }
      return next;
    });
    setIsUnsaved(true);
  };

  const startRender = async () => {
    if (!directoryPath || files.length === 0) return false;
    
    const settings: RenderSettings = {
      directoryPath,
      resolution: exportConfig.resolution,
      bitrateMbps: exportConfig.bitrateMbps,
      fps: exportConfig.fps,
      resizeMode: exportConfig.resizeMode,
      totalDuration,
      files: files,
      outputPath: exportConfig.outputPath,
      voiceAudioPath: voiceAudio ? voiceAudio.path : null,
      voiceVolumeDb: voiceVolume,
      sfxVolumeDb: sfxVolume,
      transitionEnabled,
      transitionType,
      transitionDuration,
      kenBurnsEnabled,
      preset: exportConfig.preset,
      verticalExportEnabled,
      videoTitle: videoTitle || projectName || '',
      verticalSrtPath,
      verticalTitleFontSize,
      verticalSubtitleFontSize,
      verticalTitleColor,
      verticalSubtitleColor,
      verticalTitleYPercent,
      verticalSubtitleMarginV,
      verticalSplitConfig: {
        enabled: verticalSplitEnabled,
        splitPoints: verticalSplitPoints,
        overlapSeconds: verticalOverlapSeconds
      }
    };

    setStep('rendering');
    try {
      const result = await window.electronAPI.renderVideo(settings);
      return result.success;
    } catch (err: any) {
      setRenderProgress(prev => ({ ...prev, error: err.message || 'Lỗi khi kích hoạt render.' }));
      return false;
    }
  };

  const cancelRender = async () => {
    try {
      await window.electronAPI.cancelRender();
      setStep('settings');
    } catch (err) {
      console.error('Cancel render failed:', err);
    }
  };

  const resetProject = () => {
    setDirectoryPath(null);
    setFiles([]);
    setSkipped([]);
    setLastImageStartTime(0);
    setTotalDurationState(0);
    setRenderResult(null);
    setVoiceAudio(null);
    setSfxPool([]);
    setLastManualDuration(0);
    setVoiceVolume(0);
    setSfxVolume(-12);
    setTransitionEnabled(false);
    setTransitionType('dissolve');
    setTransitionDuration(0.5);
    setKenBurnsEnabled(false);
    setProjectId(null);
    setProjectName(null);
    setIsUnsaved(false);

    // v1.8 Vertical Export States
    setVideoTitle('');
    setVerticalExportEnabled(false);
    setVerticalSrtPath('');
    setVerticalTitleFontSize(48);
    setVerticalSubtitleFontSize(54);
    setVerticalTitleColor('#FFFFFF');
    setVerticalSubtitleColor('#FFFF00');
    setVerticalTitleYPercent(7.5);
    setVerticalSubtitleMarginV(180);
    setVerticalSplitEnabled(false);
    setVerticalSplitPoints([]);
    setVerticalOverlapSeconds(5);
  };

  // ==========================================
  // Audio Actions implementation
  // ==========================================

  const addVoiceAudio = async (filePath: string, fileName: string) => {
    try {
      const res = await window.electronAPI.readAudioDuration(filePath);
      if (res.success && res.duration !== undefined) {
        setLastManualDuration(totalDuration);
        setVoiceAudio({
          path: filePath,
          name: fileName,
          duration: res.duration
        });
        setTotalDurationState(res.duration);
        setIsUnsaved(true);
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Không thể lấy độ dài âm thanh.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi đọc tệp audio.' };
    }
  };

  const removeVoiceAudio = () => {
    setVoiceAudio(null);
    setIsUnsaved(true);
  };

  const addSfxFile = async (filePath: string, fileName: string) => {
    try {
      if (sfxPool.some(s => s.path === filePath)) {
        return { success: false, error: 'Tệp hiệu ứng âm thanh này đã có trong pool.' };
      }

      const res = await window.electronAPI.readAudioDuration(filePath);
      if (res.success && res.duration !== undefined) {
        const newSfx = {
          path: filePath,
          name: fileName,
          duration: res.duration
        };
        const newPool = [...sfxPool, newSfx];
        setSfxPool(newPool);
        setFiles(prev => assignRandomSfx(prev, newPool));
        setIsUnsaved(true);
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Không thể lấy độ dài tệp SFX.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi đọc tệp SFX.' };
    }
  };

  const addSfxFiles = async (selectedFiles: { path: string; name: string }[]) => {
    try {
      const results = [];
      const skippedNames = [];
      const duplicateNames = [];

      for (const file of selectedFiles) {
        if (sfxPool.some(s => s.path === file.path) || results.some(r => r.path === file.path)) {
          duplicateNames.push(file.name);
          continue;
        }

        const res = await window.electronAPI.readAudioDuration(file.path);
        if (res.success && res.duration !== undefined) {
          results.push({
            path: file.path,
            name: file.name,
            duration: res.duration
          });
        } else {
          skippedNames.push(file.name);
        }
      }

      if (results.length > 0) {
        setSfxPool(prev => {
          const updatedPool = [...prev, ...results];
          setFiles(filesPrev => assignRandomSfx(filesPrev, updatedPool));
          return updatedPool;
        });
        setIsUnsaved(true);
      }

      return {
        success: true,
        addedCount: results.length,
        skipped: skippedNames,
        duplicates: duplicateNames
      };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.message || 'Lỗi khi import danh sách SFX.',
        addedCount: 0,
        skipped: [],
        duplicates: []
      };
    }
  };

  const removeSfxFile = (filePath: string) => {
    const newPool = sfxPool.filter(s => s.path !== filePath);
    setSfxPool(newPool);
    setFiles(prev => assignRandomSfx(prev, newPool));
    setIsUnsaved(true);
  };

  const reShuffleSfx = () => {
    setFiles(prev => assignRandomSfx(prev, sfxPool));
    setIsUnsaved(true);
  };

  // ==========================================
  // v1.3 Actions implementation
  // ==========================================
  
  const handleSetKenBurnsEnabled = (enabled: boolean) => {
    setKenBurnsEnabled(enabled);
    if (enabled) {
      setFiles(prev => assignKenBurns(prev));
    }
    setIsUnsaved(true);
  };

  const reShuffleKenBurns = () => {
    setFiles(prev => reshuffleKenBurns(prev));
    setIsUnsaved(true);
  };

  // ==========================================
  // v1.4 Actions implementation
  // ==========================================

  const refreshProjectsList = async () => {
    const list = await window.electronAPI.getProjectList();
    setProjectsList(list);
  };

  const createNewProject = () => {
    resetProject();
    // Use window.crypto.randomUUID() which is standard in Chromium
    const newId = window.crypto.randomUUID ? window.crypto.randomUUID() : 'temp_' + Date.now();
    setProjectId(newId);
    setProjectName(null);
    setCreatedAt(Date.now());
    setIsUnsaved(false);
    setStep('import');
  };

  const saveProject = async (customName?: string) => {
    if (!projectId) return { success: false, error: 'Không tìm thấy project_id.' };
    
    const nameToUse = customName || projectName;
    if (!nameToUse) {
      return { success: false, error: 'Cần đặt tên cho project.' };
    }
    
    const projectData: ProjectData = {
      version: 1,
      project_id: projectId,
      project_name: nameToUse,
      created_at: createdAt,
      updated_at: Date.now(),
      thumbnail_path: null,
      directoryPath,
      totalDuration,
      voiceAudio,
      sfxPool,
      voiceVolume,
      sfxVolume,
      transitionEnabled,
      transitionType,
      transitionDuration,
      kenBurnsEnabled,
      exportConfig,
      files,
      video_title: videoTitle,
      vertical_export_enabled: verticalExportEnabled,
      vertical_srt_path: verticalSrtPath,
      vertical_title_font_size: verticalTitleFontSize,
      vertical_subtitle_font_size: verticalSubtitleFontSize,
      vertical_title_color: verticalTitleColor,
      vertical_subtitle_color: verticalSubtitleColor,
      vertical_title_y_percent: verticalTitleYPercent,
      vertical_subtitle_margin_v: verticalSubtitleMarginV,
      vertical_split_enabled: verticalSplitEnabled,
      vertical_split_points: verticalSplitPoints,
      vertical_overlap_seconds: verticalOverlapSeconds
    };
    
    const res = await window.electronAPI.saveProject(projectData);
    if (res.success && res.project) {
      setProjectId(res.project.project_id);
      setProjectName(res.project.project_name);
      setIsUnsaved(false);
      refreshProjectsList();
      return { success: true };
    }
    return { success: false, error: res.error || 'Lỗi khi lưu project.' };
  };

  const saveProjectAs = async (newName: string) => {
    const newId = window.crypto.randomUUID ? window.crypto.randomUUID() : 'temp_' + Date.now();
    const projectData: ProjectData = {
      version: 1,
      project_id: newId,
      project_name: newName,
      created_at: Date.now(),
      updated_at: Date.now(),
      thumbnail_path: null,
      directoryPath,
      totalDuration,
      voiceAudio,
      sfxPool,
      voiceVolume,
      sfxVolume,
      transitionEnabled,
      transitionType,
      transitionDuration,
      kenBurnsEnabled,
      exportConfig,
      files,
      video_title: videoTitle,
      vertical_export_enabled: verticalExportEnabled,
      vertical_srt_path: verticalSrtPath,
      vertical_title_font_size: verticalTitleFontSize,
      vertical_subtitle_font_size: verticalSubtitleFontSize,
      vertical_title_color: verticalTitleColor,
      vertical_subtitle_color: verticalSubtitleColor,
      vertical_title_y_percent: verticalTitleYPercent,
      vertical_subtitle_margin_v: verticalSubtitleMarginV,
      vertical_split_enabled: verticalSplitEnabled,
      vertical_split_points: verticalSplitPoints,
      vertical_overlap_seconds: verticalOverlapSeconds
    };
    
    const res = await window.electronAPI.saveProject(projectData);
    if (res.success && res.project) {
      setProjectId(res.project.project_id);
      setProjectName(res.project.project_name);
      setCreatedAt(res.project.created_at);
      setIsUnsaved(false);
      refreshProjectsList();
      return { success: true };
    }
    return { success: false, error: res.error || 'Lỗi khi lưu project thành bản mới.' };
  };

  const applyLoadedProject = (project: ProjectData) => {
    setProjectId(project.project_id);
    setProjectName(project.project_name);
    setCreatedAt(project.created_at);
    setDirectoryPath(project.directoryPath);
    setFiles(project.files || []);
    setTotalDurationState(project.totalDuration);
    setVoiceAudio(project.voiceAudio);
    setSfxPool(project.sfxPool || []);
    setVoiceVolume(project.voiceVolume ?? 0);
    setSfxVolume(project.sfxVolume ?? -12);
    setTransitionEnabled(project.transitionEnabled ?? false);
    setTransitionType(project.transitionType ?? 'dissolve');
    setTransitionDuration(project.transitionDuration ?? 0.5);
    setKenBurnsEnabled(project.kenBurnsEnabled ?? false);
    setExportConfig(project.exportConfig || {
      preset: 'standard',
      resolution: '1920x1080',
      bitrateMbps: 6.0,
      fps: 30,
      resizeMode: 'fit',
      outputPath: ''
    });
    
    setVideoTitle(project.video_title || project.project_name || '');
    setVerticalExportEnabled(project.vertical_export_enabled || false);
    setVerticalSrtPath(project.vertical_srt_path || '');
    setVerticalTitleFontSize(project.vertical_title_font_size || 48);
    setVerticalSubtitleFontSize(project.vertical_subtitle_font_size || 54);
    setVerticalTitleColor(project.vertical_title_color || '#FFFFFF');
    setVerticalSubtitleColor(project.vertical_subtitle_color || '#FFFF00');
    setVerticalTitleYPercent(project.vertical_title_y_percent !== undefined ? project.vertical_title_y_percent : 7.5);
    setVerticalSubtitleMarginV(project.vertical_subtitle_margin_v !== undefined ? project.vertical_subtitle_margin_v : 180);
    setVerticalSplitEnabled(project.vertical_split_enabled || false);
    setVerticalSplitPoints(project.vertical_split_points || []);
    setVerticalOverlapSeconds(project.vertical_overlap_seconds !== undefined ? project.vertical_overlap_seconds : 5);

    setIsUnsaved(false);
    setStep('preview');
  };

  const loadProject = async (id: string) => {
    const res = await window.electronAPI.loadProject(id);
    if (res.success && res.project) {
      const project = res.project;
      
      const assetPaths: string[] = [];
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
      
      const uniquePaths = Array.from(new Set(assetPaths));
      const missing = await window.electronAPI.checkFilesExist(uniquePaths);
      
      if (missing.length > 0) {
        setTempProjectData(project);
        setMissingFiles(missing);
        return { success: true, needsRelinking: true };
      }
      
      applyLoadedProject(project);
      return { success: true };
    }
    return { success: false, error: res.error || 'Lỗi khi mở project.' };
  };

  const relinkFile = async (oldPath: string, newPath: string) => {
    if (!tempProjectData) return;
    
    const updatedFiles = (tempProjectData.files || []).map(f => {
      let updated = { ...f };
      if (f.path === oldPath) updated.path = newPath;
      if (f.sfxPath === oldPath) updated.sfxPath = newPath;
      return updated;
    });
    
    let updatedVoice = tempProjectData.voiceAudio;
    if (tempProjectData.voiceAudio && tempProjectData.voiceAudio.path === oldPath) {
      updatedVoice = { ...tempProjectData.voiceAudio, path: newPath, name: newPath.split(/[\\/]/).pop() || '' };
    }
    
    const updatedSfxPool = (tempProjectData.sfxPool || []).map(s => {
      if (s.path === oldPath) {
        return { ...s, path: newPath, name: newPath.split(/[\\/]/).pop() || '' };
      }
      return s;
    });
    
    const updatedProject: ProjectData = {
      ...tempProjectData,
      files: updatedFiles,
      voiceAudio: updatedVoice,
      sfxPool: updatedSfxPool
    };
    
    const assetPaths: string[] = [];
    for (const f of updatedFiles) {
      if (f.path) assetPaths.push(f.path);
      if (f.sfxPath) assetPaths.push(f.sfxPath);
    }
    if (updatedVoice && updatedVoice.path) {
      assetPaths.push(updatedVoice.path);
    }
    for (const s of updatedSfxPool) {
      if (s.path) assetPaths.push(s.path);
    }
    
    const uniquePaths = Array.from(new Set(assetPaths));
    const missing = await window.electronAPI.checkFilesExist(uniquePaths);
    
    setTempProjectData(updatedProject);
    setMissingFiles(missing);
    
    if (missing.length === 0) {
      applyLoadedProject(updatedProject);
      const saveRes = await window.electronAPI.saveProject(updatedProject);
      if (saveRes.success) {
        refreshProjectsList();
      }
      setTempProjectData(null);
    }
  };

  const ignoreMissingFiles = async () => {
    if (!tempProjectData) return;
    
    const updatedFiles = (tempProjectData.files || [])
      .filter(f => !missingFiles.includes(f.path))
      .map(f => {
        let updated = { ...f };
        if (f.sfxPath && missingFiles.includes(f.sfxPath)) {
          updated.sfxPath = null;
          updated.sfxName = null;
        }
        return updated;
      });
      
    let updatedVoice = tempProjectData.voiceAudio;
    if (tempProjectData.voiceAudio && missingFiles.includes(tempProjectData.voiceAudio.path)) {
      updatedVoice = null;
    }
    
    const updatedSfxPool = (tempProjectData.sfxPool || [])
      .filter(s => !missingFiles.includes(s.path));
       
    const updatedProject: ProjectData = {
      ...tempProjectData,
      files: updatedFiles,
      voiceAudio: updatedVoice,
      sfxPool: updatedSfxPool
    };
    
    applyLoadedProject(updatedProject);
    
    const saveRes = await window.electronAPI.saveProject(updatedProject);
    if (saveRes.success) {
      refreshProjectsList();
    }
    
    setTempProjectData(null);
    setMissingFiles([]);
  };

  const cancelRelinking = () => {
    setTempProjectData(null);
    setMissingFiles([]);
    setStep('dashboard');
  };

  const duplicateProject = async (id: string) => {
    const res = await window.electronAPI.duplicateProject(id);
    if (res.success) {
      refreshProjectsList();
      return { success: true };
    }
    return { success: false, error: res.error || 'Lỗi khi nhân bản project.' };
  };

  const deleteProject = async (id: string) => {
    const res = await window.electronAPI.deleteProject(id);
    if (res.success) {
      refreshProjectsList();
      if (projectId === id) {
        resetProject();
        setStep('dashboard');
      }
      return { success: true };
    }
    return { success: false, error: res.error || 'Lỗi khi xóa project.' };
  };
  
  const deleteFile = (filePath: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.path !== filePath);
      const { updatedFiles, newTotalDuration } = recalculateStartTimes(filtered);
      if (!voiceAudio) {
        setTotalDurationState(newTotalDuration);
      }
      return updatedFiles;
    });
    setIsUnsaved(true);
  };

  const cascadeShift = (index: number, direction: 'forward' | 'backward') => {
    setFiles(prev => {
      if (prev.length <= 1) return prev;
      const newFiles = [...prev];
      const n = newFiles.length;
      
      if (direction === 'forward') {
        // Shift right: dur[j] = dur[j-1] for j from n-1 down to index + 1
        for (let j = n - 1; j > index; j--) {
          newFiles[j] = { ...newFiles[j], duration: newFiles[j-1].duration };
        }
      } else {
        // Shift left: dur[j] = dur[j+1] for j from index to n-2
        for (let j = index; j < n - 1; j++) {
          newFiles[j] = { ...newFiles[j], duration: newFiles[j+1].duration };
        }
      }
      
      const { updatedFiles, newTotalDuration } = recalculateStartTimes(newFiles);
      if (!voiceAudio) {
        setTotalDurationState(newTotalDuration);
      }
      return updatedFiles;
    });
    setIsUnsaved(true);
  };

  return (
    <ProjectContext.Provider value={{
      step,
      directoryPath,
      files,
      skipped,
      lastImageStartTime,
      totalDuration,
      exportConfig,
      renderProgress,
      renderResult,
      
      voiceAudio,
      sfxPool,

      // v1.3 States
      voiceVolume,
      sfxVolume,
      transitionEnabled,
      transitionType,
      transitionDuration,
      kenBurnsEnabled,

      // v1.4 States
      projectId,
      projectName,
      isUnsaved,
      projectsList,
      missingFiles,
      tempProjectData,
      videoTitle,
      verticalExportEnabled,
      verticalSrtPath,
      verticalTitleFontSize,
      verticalSubtitleFontSize,
      verticalTitleColor,
      verticalSubtitleColor,
      verticalTitleYPercent,
      verticalSubtitleMarginV,
      verticalSplitEnabled,
      verticalSplitPoints,
      verticalOverlapSeconds,
      
      setStep,
      setVideoTitle,
      setVerticalExportEnabled,
      setVerticalSrtPath,
      setVerticalTitleFontSize,
      setVerticalSubtitleFontSize,
      setVerticalTitleColor,
      setVerticalSubtitleColor,
      setVerticalTitleYPercent,
      setVerticalSubtitleMarginV,
      setVerticalSplitEnabled,
      setVerticalSplitPoints,
      setVerticalOverlapSeconds,
      importDirectory,
      setTotalDuration,
      updateExportConfig,
      startRender,
      cancelRender,
      resetProject,
      setFiles,
      deleteFile,
      cascadeShift,
      
      addVoiceAudio,
      removeVoiceAudio,
      addSfxFile,
      addSfxFiles,
      removeSfxFile,
      reShuffleSfx,

      // v1.3 Actions
      setVoiceVolume,
      setSfxVolume,
      setTransitionEnabled,
      setTransitionType,
      setTransitionDuration,
      setKenBurnsEnabled: handleSetKenBurnsEnabled,
      reShuffleKenBurns,

      // v1.4 Actions
      saveProject,
      saveProjectAs,
      loadProject,
      duplicateProject,
      deleteProject,
      refreshProjectsList,
      createNewProject,
      relinkFile,
      ignoreMissingFiles,
      cancelRelinking,
      markAsDirty
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
