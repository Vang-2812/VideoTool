import React from 'react';
import { useProject } from '../context/ProjectContext';
import type { ExportConfig } from '../context/ProjectContext';
import { Settings, ArrowLeft, Video, Sliders, FolderClosed, Save, MonitorPlay, Smartphone, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import VerticalSplitSettings from './VerticalSplitSettings';
import { formatTimestamp } from '../../shared/verticalSegments.js';

export default function SettingsScreen() {
  const { 
    projectName,
    exportConfig, 
    updateExportConfig, 
    totalDuration, 
    files, 
    directoryPath, 
    setStep, 
    startRender,
    videoTitle,
    setVideoTitle,
    verticalExportEnabled,
    setVerticalExportEnabled,
    verticalSrtPath,
    setVerticalSrtPath,
    verticalTitleFontSize,
    setVerticalTitleFontSize,
    verticalSubtitleFontSize,
    setVerticalSubtitleFontSize,
    verticalTitleColor,
    setVerticalTitleColor,
    verticalSubtitleColor,
    setVerticalSubtitleColor,
    verticalTitleYPercent,
    setVerticalTitleYPercent,
    verticalSubtitleMarginV,
    setVerticalSubtitleMarginV,
    verticalSplitEnabled,
    setVerticalSplitEnabled,
    verticalSplitPoints,
    setVerticalSplitPoints,
    verticalOverlapSeconds,
    setVerticalOverlapSeconds
  } = useProject();

  const [verticalMarkerInputs, setVerticalMarkerInputs] = React.useState<string[]>(
    verticalSplitPoints.map(formatTimestamp)
  );
  const [verticalSplitValid, setVerticalSplitValid] = React.useState(true);

  React.useEffect(() => {
    setVerticalMarkerInputs(verticalSplitPoints.map(formatTimestamp));
  }, [verticalSplitPoints]);

  const handleProjectSplitValidation = React.useCallback((validation: { valid: boolean; splitPoints: number[] }) => {
    setVerticalSplitValid(validation.valid);
    if (validation.valid) setVerticalSplitPoints(validation.splitPoints);
  }, [setVerticalSplitPoints]);

  const handleMarkerInputsChange = React.useCallback((inputs: string[]) => {
    setVerticalMarkerInputs(inputs);
  }, []);

  const [srtValidation, setSrtValidation] = React.useState<{ valid: boolean; errorCount: number; errors: string[] } | null>(null);

  React.useEffect(() => {
    if (verticalSrtPath) {
      window.electronAPI.validateSrt(verticalSrtPath).then(setSrtValidation).catch(console.error);
    } else {
      setSrtValidation(null);
    }
  }, [verticalSrtPath]);

  const handleSelectVerticalSrt = async () => {
    try {
      const res = await window.electronAPI.selectRelinkFile(['srt']);
      if (res) {
        setVerticalSrtPath(res.path);
      }
    } catch (e) {
      console.error('Failed to select vertical srt:', e);
    }
  };

  const handleClearVerticalSrt = () => {
    setVerticalSrtPath('');
  };

  const handlePresetSelect = (preset: ExportConfig['preset']) => {
    updateExportConfig({ preset });
  };

  const handleFrameRateSelect = (fps: number) => {
    updateExportConfig({ fps });
  };

  const handleResizeModeSelect = (resizeMode: ExportConfig['resizeMode']) => {
    updateExportConfig({ resizeMode });
  };

  const handleBrowseOutputPath = async () => {
    try {
      const defaultPath = exportConfig.outputPath || `${directoryPath}\\output_video.mp4`;
      const chosenPath = await window.electronAPI.selectSavePath(defaultPath);
      if (chosenPath) {
        updateExportConfig({ outputPath: chosenPath });
      }
    } catch (err) {
      console.error('Failed to select save path:', err);
    }
  };

  const handleStartRender = async () => {
    if (!exportConfig.outputPath) {
      alert("Vui lòng chọn đường dẫn lưu video xuất!");
      return;
    }
    if (verticalExportEnabled && verticalSplitEnabled && !verticalSplitValid) {
      alert("Cấu hình phân đoạn video dọc không hợp lệ. Vui lòng kiểm tra lại các mốc thời gian!");
      return;
    }
    await startRender();
  };

  // Helper to split resolution into width/height for display or custom inputs
  const parseResolution = (res: string) => {
    const parts = res.split('x');
    return {
      width: parts[0] || '1920',
      height: parts[1] || '1080'
    };
  };

  const resVal = parseResolution(exportConfig.resolution);

  const handleCustomWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const width = e.target.value.replace(/\D/g, '');
    updateExportConfig({ 
      preset: 'custom', 
      resolution: `${width}x${resVal.height}` 
    });
  };

  const handleCustomHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const height = e.target.value.replace(/\D/g, '');
    updateExportConfig({ 
      preset: 'custom', 
      resolution: `${resVal.width}x${height}` 
    });
  };

  const handleCustomBitrateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bitrate = parseFloat(e.target.value);
    if (!isNaN(bitrate)) {
      updateExportConfig({ preset: 'custom', bitrateMbps: bitrate });
    }
  };

  return (
    <div className="flex flex-col h-full py-4 space-y-6">
      {/* Page Title */}
      <div className="bg-bg-panel p-6 rounded-2xl border border-border-dark shadow-lg">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="text-primary w-6 h-6" />
          Bước 3: Cấu hình xuất video (Export Settings)
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Thiết lập chất lượng đầu ra, tỷ lệ khung hình, và vị trí lưu video.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left Columns - Settings Panels (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Preset Panel */}
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-border-dark pb-2">
              <Video className="w-4 h-4 text-primary" />
              Chất lượng xuất (Presets)
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'draft', label: 'Draft (720p)', res: '1280x720', desc: 'Nháp / Xuất nhanh' },
                { id: 'standard', label: 'Medium (1080p)', res: '1920x1080', desc: 'Xuất chuẩn 6Mbps' },
                { id: 'high', label: 'High (1080p)', res: '1920x1080', desc: 'YouTube 12Mbps' },
                { id: '4k', label: '4K Master', res: '3840x2160', desc: 'Chất lượng cao' }
              ].map((p) => {
                const isActive = exportConfig.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id as any)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between h-24 cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/5 text-white shadow shadow-primary/10' : 'border-border-dark hover:border-gray-500 bg-bg-card/50 text-gray-400'}`}
                  >
                    <span className="text-xs font-semibold block">{p.label}</span>
                    <div>
                      <span className="text-[10px] font-mono block text-gray-500">{p.res}</span>
                      <span className="text-[9px] block text-gray-500 mt-1 truncate">{p.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Preset values */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="radio" 
                  id="preset-custom" 
                  checked={exportConfig.preset === 'custom'}
                  onChange={() => handlePresetSelect('custom')}
                  className="accent-primary"
                />
                <label htmlFor="preset-custom" className="text-xs font-semibold text-gray-300 cursor-pointer">
                  Tùy chỉnh cấu hình nâng cao
                </label>
              </div>

              {exportConfig.preset === 'custom' && (
                <div className="bg-bg-dark border border-border-dark p-4 rounded-xl grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Chiều rộng (px)</label>
                    <input 
                      type="text" 
                      value={resVal.width}
                      onChange={handleCustomWidthChange}
                      className="bg-bg-card border border-border-dark text-white px-3 py-1.5 rounded-lg font-mono text-xs w-full outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Chiều cao (px)</label>
                    <input 
                      type="text" 
                      value={resVal.height}
                      onChange={handleCustomHeightChange}
                      className="bg-bg-card border border-border-dark text-white px-3 py-1.5 rounded-lg font-mono text-xs w-full outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Bitrate (Mbps)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      min="0.5"
                      value={exportConfig.bitrateMbps}
                      onChange={handleCustomBitrateChange}
                      className="bg-bg-card border border-border-dark text-white px-3 py-1.5 rounded-lg font-mono text-xs w-full outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Framerate & Scale Mode Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Framerate Selection */}
            <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-border-dark pb-2">
                <Sliders className="w-4 h-4 text-primary" />
                Số khung hình (Frame rate)
              </h3>
              
              <div className="flex gap-2">
                {[24, 30, 60].map((fps) => {
                  const isActive = exportConfig.fps === fps;
                  return (
                    <button
                      key={fps}
                      onClick={() => handleFrameRateSelect(fps)}
                      className={`flex-1 py-2.5 rounded-xl border font-mono text-xs cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/5 text-white font-semibold' : 'border-border-dark hover:border-gray-500 bg-bg-card/50 text-gray-400'}`}
                    >
                      {fps} FPS
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scaling Mode Selection */}
            <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-border-dark pb-2">
                <MonitorPlay className="w-4 h-4 text-primary" />
                Tỷ lệ xử lý ảnh (Resize mode)
              </h3>
              
              <div className="flex gap-2">
                {[
                  { id: 'fit', label: 'Fit' },
                  { id: 'fill', label: 'Fill' },
                  { id: 'stretch', label: 'Stretch' }
                ].map((mode) => {
                  const isActive = exportConfig.resizeMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleResizeModeSelect(mode.id as any)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/5 text-white font-semibold' : 'border-border-dark hover:border-gray-500 bg-bg-card/50 text-gray-400'}`}
                      title={
                        mode.id === 'fit' ? 'Giữ nguyên tỉ lệ, chèn viền đen' : 
                        mode.id === 'fill' ? 'Cắt ảnh để phủ đầy khung hình' : 
                        'Kéo dãn ảnh cho vừa khít khung hình'
                      }
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vertical 9:16 Panel (New v1.8) */}
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-border-dark pb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                Xuất thêm bản dọc 9:16 (TikTok/Reels)
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="verticalExportToggle"
                  checked={verticalExportEnabled}
                  onChange={(e) => setVerticalExportEnabled(e.target.checked)}
                  className="accent-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="verticalExportToggle" className="text-xs text-gray-300 font-semibold cursor-pointer select-none">
                  Kích hoạt
                </label>
              </div>
            </div>

            {verticalExportEnabled && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 block">Tiêu đề video dọc</label>
                  <input
                    type="text"
                    placeholder="Gõ tiêu đề video dọc..."
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-4 py-2 rounded-xl text-xs outline-none font-sans transition-colors"
                  />
                </div>

                {/* Cấu hình văn bản dọc (v1.8) */}
                <div className="space-y-4 pt-1">
                  {/* Title Config Section */}
                  <div className="bg-bg-dark border border-border-dark/60 p-3.5 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-primary uppercase">Cài đặt tiêu đề (Top)</div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Font size */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-semibold">Cỡ chữ</span>
                          <span className="font-mono text-primary font-bold">{verticalTitleFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="24"
                          max="80"
                          value={verticalTitleFontSize}
                          onChange={(e) => setVerticalTitleFontSize(parseInt(e.target.value, 10))}
                          className="w-full accent-primary bg-bg-panel h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      {/* Position Y */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-semibold">Vị trí Y (%)</span>
                          <span className="font-mono text-primary font-bold">{verticalTitleYPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="40"
                          step="0.5"
                          value={verticalTitleYPercent}
                          onChange={(e) => setVerticalTitleYPercent(parseFloat(e.target.value))}
                          className="w-full accent-primary bg-bg-panel h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Color selector */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-400 font-semibold block">Màu sắc tiêu đề</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={verticalTitleColor}
                          onChange={(e) => setVerticalTitleColor(e.target.value)}
                          className="w-7 h-7 rounded border border-border-dark bg-transparent cursor-pointer shrink-0"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {['#FFFFFF', '#FFFF00', '#FF5555', '#55FF55', '#55FFFF'].map(c => (
                            <button
                              key={c}
                              onClick={() => setVerticalTitleColor(c)}
                              className={`w-4 h-4 rounded-full border transition-transform ${verticalTitleColor.toLowerCase() === c.toLowerCase() ? 'border-primary scale-110' : 'border-transparent hover:scale-105'}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subtitle Config Section */}
                  <div className="bg-bg-dark border border-border-dark/60 p-3.5 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-accent uppercase">Cài đặt phụ đề (Bottom)</div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Font size */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-semibold">Cỡ chữ</span>
                          <span className="font-mono text-accent font-bold">{verticalSubtitleFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="24"
                          max="80"
                          value={verticalSubtitleFontSize}
                          onChange={(e) => setVerticalSubtitleFontSize(parseInt(e.target.value, 10))}
                          className="w-full accent-accent bg-bg-panel h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      {/* Position MarginV */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-semibold">Khoảng cách dưới</span>
                          <span className="font-mono text-accent font-bold">{verticalSubtitleMarginV}px</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="450"
                          step="10"
                          value={verticalSubtitleMarginV}
                          onChange={(e) => setVerticalSubtitleMarginV(parseInt(e.target.value, 10))}
                          className="w-full accent-accent bg-bg-panel h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Color selector */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-400 font-semibold block">Màu sắc phụ đề</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={verticalSubtitleColor}
                          onChange={(e) => setVerticalSubtitleColor(e.target.value)}
                          className="w-7 h-7 rounded border border-border-dark bg-transparent cursor-pointer shrink-0"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {['#FFFFFF', '#FFFF00', '#FF5555', '#55FF55', '#55FFFF'].map(c => (
                            <button
                              key={c}
                              onClick={() => setVerticalSubtitleColor(c)}
                              className={`w-4 h-4 rounded-full border transition-transform ${verticalSubtitleColor.toLowerCase() === c.toLowerCase() ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subtitles */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-400 block">Tệp phụ đề rời (.srt) - Tùy chọn</label>
                    {verticalSrtPath && (
                      <button
                        onClick={handleClearVerticalSrt}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                      >
                        Xóa bỏ
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSelectVerticalSrt}
                      className="px-3.5 py-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Chọn file SRT
                    </button>
                    <div className="flex-1 bg-bg-dark border border-border-dark/60 rounded-lg px-3 py-1.5 flex items-center text-xs text-gray-400 font-mono overflow-hidden">
                      {verticalSrtPath ? (
                        <span className="text-white truncate" title={verticalSrtPath}>
                          {verticalSrtPath.split(/[\\/]/).pop()}
                        </span>
                      ) : (
                        <span className="text-gray-600 italic">Không sử dụng phụ đề</span>
                      )}
                    </div>
                  </div>
                  {/* SRT Validation Feedback */}
                  {srtValidation && (
                    <div className="animate-in fade-in duration-200 mt-2">
                      {srtValidation.valid ? (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] p-2.5 rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          <span>File phụ đề hợp lệ! Đã xác thực thành công cấu trúc SRT.</span>
                        </div>
                      ) : (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-3 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-2 font-semibold">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>Phát hiện {srtValidation.errorCount} lỗi cấu trúc trong tệp SRT:</span>
                          </div>
                          <ul className="list-disc pl-5 space-y-0.5 text-gray-400 font-mono text-[10px] leading-relaxed">
                            {srtValidation.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                            {srtValidation.errorCount > srtValidation.errors.length && (
                              <li>... và {srtValidation.errorCount - srtValidation.errors.length} lỗi khác ở bên dưới.</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Split Settings */}
                <div className="pt-2 border-t border-border-dark">
                  <VerticalSplitSettings
                    enabled={verticalSplitEnabled}
                    onEnabledChange={setVerticalSplitEnabled}
                    markerInputs={verticalMarkerInputs}
                    onMarkerInputsChange={handleMarkerInputsChange}
                    overlapSeconds={verticalOverlapSeconds}
                    onOverlapSecondsChange={setVerticalOverlapSeconds}
                    duration={totalDuration}
                    baseFilename={exportConfig.outputPath ? exportConfig.outputPath.split(/[\\/]/).pop() || 'video.mp4' : 'video.mp4'}
                    title={videoTitle}
                    onValidationChange={handleProjectSplitValidation}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary & Trigger (2/5) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-panel border border-border-dark rounded-2xl p-6 shadow-lg flex flex-col justify-between min-h-[380px]">
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-border-dark pb-2">
                <FolderClosed className="w-4 h-4 text-primary" />
                Tổng quan dự án
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Thư mục nguồn:</span>
                  <span className="text-white font-mono truncate max-w-[180px]" title={directoryPath || ''}>
                    {directoryPath ? directoryPath.split('\\').pop() : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tổng số ảnh:</span>
                  <span className="text-white font-semibold">{files.length} ảnh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tổng thời lượng:</span>
                  <span className="text-accent font-semibold font-mono">{totalDuration.toFixed(1)} giây</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Resolution đầu ra:</span>
                  <span className="text-white font-mono">{exportConfig.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bitrate / Frame rate:</span>
                  <span className="text-white font-mono">{exportConfig.bitrateMbps} Mbps @ {exportConfig.fps}fps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chế độ resize:</span>
                  <span className="text-white font-semibold uppercase">{exportConfig.resizeMode}</span>
                </div>
              </div>

              {/* Output File Selector */}
              <div className="space-y-2 border-t border-border-dark pt-4">
                <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Nơi lưu video kết quả
                </label>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly
                    value={exportConfig.outputPath}
                    placeholder="Chưa chọn đường dẫn xuất"
                    className="bg-bg-dark border border-border-dark text-gray-300 text-xs px-3 py-2 rounded-xl flex-1 outline-none truncate font-mono"
                  />
                  <button
                    onClick={handleBrowseOutputPath}
                    className="bg-bg-card hover:bg-bg-dark border border-border-dark px-3 py-2 rounded-xl text-xs text-white font-semibold cursor-pointer transition-colors"
                  >
                    Chọn
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4 border-t border-border-dark pt-6 mt-6">
              <button 
                onClick={() => setStep('preview')}
                className="flex-1 py-3 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>
              
              <button 
                onClick={handleStartRender}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
              >
                Bắt đầu xuất
              </button>
            </div>
          </div>

          {/* WYSIWYG Layout Preview (v1.8) */}
          {verticalExportEnabled && (
            <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-border-dark pb-2">
                <Smartphone className="w-4 h-4 text-primary" />
                Xem trước bố cục dọc (Layout Preview)
              </h3>
              
              <div className="flex justify-center py-2">
                <div className="w-52 h-[340px] bg-[#0c0c0e] rounded-[2rem] border-[5px] border-gray-800 shadow-2xl relative overflow-hidden select-none">
                  
                  {/* Video Area representing background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-[#0e0e11] to-purple-950/20 flex flex-col items-center justify-center">
                    <div className="w-full h-[100px] bg-gray-900/60 border-y border-white/5 flex items-center justify-center text-[9px] text-gray-500 font-mono">
                      [ Video fit ngang ]
                    </div>
                  </div>

                  {/* Top Title Area - Absolute Position */}
                  <div 
                    className="absolute w-full bg-black/45 backdrop-blur-[1px] px-2 py-1 flex items-center justify-center text-center font-bold leading-tight overflow-hidden break-words border-y border-white/5 font-sans"
                    style={{ 
                      top: `${verticalTitleYPercent}%`, 
                      transform: 'translateY(-50%)',
                      fontSize: `${Math.max(8, verticalTitleFontSize * 340 / 1920)}px`,
                      color: verticalTitleColor
                    }}
                  >
                    {videoTitle ? videoTitle : (projectName ? projectName : "TIÊU ĐỀ VIDEO")}
                  </div>

                  {/* Bottom Subtitle Area - Absolute Position */}
                  <div 
                    className="absolute w-full bg-black/45 backdrop-blur-[1px] px-2 py-1 flex items-center justify-center text-center font-bold leading-tight overflow-hidden break-words font-sans"
                    style={{ 
                      bottom: `${verticalSubtitleMarginV * 340 / 1920}px`, 
                      transform: 'translateX(-50%)',
                      left: '50%',
                      fontSize: `${Math.max(8, verticalSubtitleFontSize * 340 / 1920)}px`,
                      color: verticalSubtitleColor
                    }}
                  >
                    {verticalSrtPath ? "Dòng phụ đề ví dụ..." : "Không dùng phụ đề"}
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] text-gray-500 font-mono text-center">
                Mô phỏng bố cục tỉ lệ thực tế trên màn hình 9:16
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
