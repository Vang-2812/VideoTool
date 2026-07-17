import React, { useState, useEffect } from 'react';
import { 
  FileVideo, 
  Upload, 
  FileText, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Smartphone,
  AlertTriangle
} from 'lucide-react';
import VerticalSplitSettings from './VerticalSplitSettings';

export default function VerticalConvertScreen() {
  const [videoFile, setVideoFile] = useState<{ path: string; name: string } | null>(null);
  const [srtFile, setSrtFile] = useState<{ path: string; name: string } | null>(null);
  const [srtValidation, setSrtValidation] = useState<{ valid: boolean; errorCount: number; errors: string[] } | null>(null);
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState<'draft' | 'standard' | 'high' | '4k'>('standard');
  const [titleFontSize, setTitleFontSize] = useState<number>(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(54);
  const [titleColor, setTitleColor] = useState<string>('#FFFFFF');
  const [subtitleColor, setSubtitleColor] = useState<string>('#FFFF00');
  const [titleYPercent, setTitleYPercent] = useState<number>(7.5);
  const [subtitleMarginV, setSubtitleMarginV] = useState<number>(180);
  const [activeTab, setActiveTab] = useState<'title' | 'subtitle'>('title');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('--:--');
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [markerInputs, setMarkerInputs] = useState<string[]>([]);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [overlapSeconds, setOverlapSeconds] = useState(5);
  const [splitValid, setSplitValid] = useState(true);
  const [segmentIndex, setSegmentIndex] = useState<number | null>(null);
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [result, setResult] = useState<{ success: boolean; outputPaths?: string[]; path?: string; error?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onVerticalConvertProgress((payload) => {
      setProgress(payload.progress);
      setEta(payload.eta);
      setSegmentIndex(payload.segmentIndex ?? null);
      setSegmentCount(payload.segmentCount ?? null);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSelectVideo = async () => {
    try {
      const res = await window.electronAPI.selectVideoFile();
      if (res) {
        setVideoFile(res);
        // Automatically default title to video file name (without extension)
        const nameWithoutExt = res.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
        setResult(null);

        // Fetch duration
        const durationResult = await window.electronAPI.getVideoDuration(res.path);
        setVideoDuration(durationResult.success ? durationResult.duration ?? null : null);
      }
    } catch (e) {
      console.error('Failed to select video:', e);
    }
  };

  const handleSelectSrt = async () => {
    try {
      const res = await window.electronAPI.selectRelinkFile(['srt']);
      if (res) {
        setSrtFile(res);
        setResult(null);
        
        // Validate srt file immediately
        const valRes = await window.electronAPI.validateSrt(res.path);
        setSrtValidation(valRes);
      }
    } catch (e) {
      console.error('Failed to select srt:', e);
    }
  };

  const handleClearSrt = () => {
    setSrtFile(null);
    setSrtValidation(null);
  };

  const handleStandaloneSplitValidation = React.useCallback((validation: { valid: boolean; splitPoints: number[] }) => {
    setSplitValid(validation.valid);
    if (validation.valid) setSplitPoints(validation.splitPoints);
  }, []);

  const handleConvert = async () => {
    if (!videoFile) return;

    // 1. Ask user for save path or output directory
    const outputDirectory = splitEnabled
      ? await window.electronAPI.selectExportDirectory()
      : null;
    const savePath = splitEnabled
      ? undefined
      : await window.electronAPI.selectSavePath(videoFile.path.replace(/\.mp4$/i, '_vertical.mp4'));

    if ((splitEnabled && !outputDirectory) || (!splitEnabled && !savePath)) return;

    setLoading(true);
    setProgress(0);
    setEta('--:--');
    setResult(null);
    setSegmentIndex(null);
    setSegmentCount(null);

    try {
      const res = await window.electronAPI.convertToVertical({
        sourceVideoPath: videoFile.path,
        outputPath: savePath ?? '',
        title: title.trim(),
        srtPath: srtFile ? srtFile.path : '',
        qualityPreset: preset,
        titleFontSize,
        subtitleFontSize,
        titleColor,
        subtitleColor,
        titleYPercent,
        subtitleMarginV,
        splitConfig: {
          enabled: splitEnabled,
          splitPoints,
          overlapSeconds,
          outputDirectory: outputDirectory ?? undefined,
          outputBaseName: videoFile.name
        }
      });

      const normalizedResult = splitEnabled
        ? res
        : { ...res, outputPaths: res.success && savePath ? [savePath] : [] };

      setResult(normalizedResult);
    } catch (err: any) {
      setResult({ success: false, error: err.message || 'Lỗi hệ thống.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await window.electronAPI.cancelVerticalConvert();
      setLoading(false);
      setProgress(null);
      setResult({ success: false, error: 'Tiến trình chuyển đổi đã bị hủy bỏ bởi người dùng.' });
    } catch (e) {
      console.error('Failed to cancel conversion:', e);
    }
  };

  const handleOpenFolder = () => {
    const pathObj = result?.outputPaths?.[0] || result?.path;
    if (pathObj) {
      window.electronAPI.openDirectory(pathObj);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-3 h-[calc(100vh-80px)] flex flex-col overflow-hidden">
      
      {/* Header Title */}
      <div className="flex items-center gap-3 border-b border-border-dark pb-2.5 shrink-0">
        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Công Cụ Chuyển Đổi Video Dọc 9:16 (Standalone)
          </h2>
          <span className="text-[10px] text-gray-500 font-mono">
            Biến video ngang thành bản dọc TikTok / Facebook Reels tích hợp phụ đề & tiêu đề
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1 overflow-hidden min-h-0 pt-3">
        
        {/* Left Config Panel (3/5 cols) */}
        <div className="md:col-span-3 bg-bg-panel border border-border-dark p-4 rounded-2xl shadow-lg flex flex-col justify-between overflow-y-auto space-y-3 max-h-full min-h-0 signature-top-indicator">
          
          <div className="space-y-3">
            {/* Select Video & SRT (Grid) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Select Video */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 block">Tệp video ngang gốc (.mp4)</label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectVideo}
                    className="px-3 py-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    <FileVideo className="w-3.5 h-3.5 text-primary" />
                    Chọn
                  </button>
                  <div className="flex-1 bg-bg-dark border border-border-dark/60 rounded-xl px-3 py-1.5 flex items-center text-[11px] text-gray-400 font-mono overflow-hidden h-[34px]">
                    {videoFile ? (
                      <span className="text-white truncate" title={videoFile.path}>{videoFile.name}</span>
                    ) : (
                      <span className="text-gray-600 italic">Chưa chọn</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Select Subtitles (SRT) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-gray-400 block">Tệp phụ đề rời (.srt)</label>
                  {srtFile && (
                    <button 
                      onClick={handleClearSrt} 
                      className="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectSrt}
                    disabled={!videoFile}
                    className="px-3 py-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark disabled:opacity-40 text-gray-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-accent" />
                    Chọn
                  </button>
                  <div className="flex-1 bg-bg-dark border border-border-dark/60 rounded-xl px-3 py-1.5 flex items-center text-[11px] text-gray-400 font-mono overflow-hidden h-[34px]">
                    {srtFile ? (
                      <span className="text-white truncate" title={srtFile.path}>{srtFile.name}</span>
                    ) : (
                      <span className="text-gray-600 italic">Không dùng</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SRT Validation Feedback */}
            {srtValidation && (
              <div className="animate-in fade-in duration-200">
                {srtValidation.valid ? (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] p-1.5 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span>File phụ đề hợp lệ! Xác thực thành công.</span>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] p-2 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>Phát hiện {srtValidation.errorCount} lỗi cấu trúc trong tệp SRT:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-400 font-mono text-[9px] max-h-[60px] overflow-y-auto leading-relaxed">
                      {srtValidation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 block">Tiêu đề video hiển thị (ở vùng trên)</label>
              <input
                type="text"
                placeholder="Nhập tiêu đề cho video..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!videoFile}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-xl text-xs outline-none font-sans transition-colors"
              />
            </div>

            {/* Cấu hình văn bản dọc (v1.8) với Tabbed interface */}
            <div className="space-y-2 pt-2 border-t border-border-dark">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Cấu hình chữ trên video</h4>
                <div className="flex bg-bg-dark border border-border-dark/60 rounded-lg p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('title')}
                    className={`px-3 py-0.5 rounded font-semibold transition-all cursor-pointer ${activeTab === 'title' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white'}`}
                  >
                    Tiêu đề
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('subtitle')}
                    className={`px-3 py-0.5 rounded font-semibold transition-all cursor-pointer ${activeTab === 'subtitle' ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white'}`}
                  >
                    Phụ đề
                  </button>
                </div>
              </div>

              {activeTab === 'title' ? (
                <div className="bg-bg-panel border border-border-dark/60 p-2.5 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Font size */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold">Cỡ chữ</span>
                        <span className="font-mono text-primary font-bold">{titleFontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="24"
                        max="80"
                        value={titleFontSize}
                        onChange={(e) => setTitleFontSize(parseInt(e.target.value, 10))}
                        className="w-full custom-slider cursor-pointer"
                      />
                    </div>
                    {/* Position Y */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold">Vị trí Y (%)</span>
                        <span className="font-mono text-primary font-bold">{titleYPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="40"
                        step="0.5"
                        value={titleYPercent}
                        onChange={(e) => setTitleYPercent(parseFloat(e.target.value))}
                        className="w-full custom-slider cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Color selector */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold block">Màu sắc</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={titleColor}
                        onChange={(e) => setTitleColor(e.target.value)}
                        className="w-6 h-6 rounded-md border border-border-dark bg-transparent cursor-pointer shrink-0 p-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['#FFFFFF', '#FFFF00', '#FF5555', '#55FF55', '#55FFFF'].map(c => (
                          <button
                            key={c}
                            onClick={() => setTitleColor(c)}
                            className={`w-5 h-5 rounded-lg border-2 transition-all cursor-pointer ${titleColor.toLowerCase() === c.toLowerCase() ? 'border-primary shadow-sm shadow-primary/40 scale-110' : 'border-border-dark hover:border-gray-400'}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-bg-panel border border-border-dark/60 p-2.5 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Font size */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold">Cỡ chữ</span>
                        <span className="font-mono text-accent font-bold">{subtitleFontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="24"
                        max="80"
                        value={subtitleFontSize}
                        onChange={(e) => setSubtitleFontSize(parseInt(e.target.value, 10))}
                        className="w-full custom-slider cursor-pointer"
                      />
                    </div>
                    {/* Position MarginV */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold">Khoảng cách dưới</span>
                        <span className="font-mono text-accent font-bold">{subtitleMarginV}px</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="450"
                        step="10"
                        value={subtitleMarginV}
                        onChange={(e) => setSubtitleMarginV(parseInt(e.target.value, 10))}
                        className="w-full custom-slider cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Subtitle Color selector */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold block">Màu phụ đề</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="w-6 h-6 rounded-md border border-border-dark bg-transparent cursor-pointer shrink-0 p-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['#FFFF00', '#FFFFFF', '#FF5555', '#55FF55', '#55FFFF'].map(c => (
                          <button
                            key={c}
                            onClick={() => setSubtitleColor(c)}
                            className={`w-5 h-5 rounded-lg border-2 transition-all cursor-pointer ${subtitleColor.toLowerCase() === c.toLowerCase() ? 'border-accent shadow-sm shadow-accent/40 scale-110' : 'border-border-dark hover:border-gray-400'}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color selector */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold block">Màu sắc</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="w-6 h-6 rounded border border-border-dark bg-transparent cursor-pointer shrink-0 p-0"
                      />
                      <div className="flex flex-wrap gap-1">
                        {['#FFFFFF', '#FFFF00', '#FF5555', '#55FF55', '#55FFFF'].map(c => (
                          <button
                            key={c}
                            onClick={() => setSubtitleColor(c)}
                            className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${subtitleColor.toLowerCase() === c.toLowerCase() ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Split Settings */}
            <div className="pt-2 border-t border-border-dark">
              <VerticalSplitSettings
                enabled={splitEnabled}
                onEnabledChange={setSplitEnabled}
                markerInputs={markerInputs}
                onMarkerInputsChange={setMarkerInputs}
                overlapSeconds={overlapSeconds}
                onOverlapSecondsChange={setOverlapSeconds}
                duration={videoDuration}
                baseFilename={videoFile?.name ?? 'video.mp4'}
                title={title}
                onValidationChange={handleStandaloneSplitValidation}
              />
            </div>

            {/* Resolution Presets */}
            <div className="space-y-1.5 pt-2 border-t border-border-dark">
              <label className="text-[11px] font-bold text-gray-400 block">Độ phân giải xuất dọc</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'draft', label: '720p', desc: 'Draft' },
                  { id: 'standard', label: '1080p', desc: 'Standard' },
                  { id: 'high', label: '1080p+', desc: 'High' },
                  { id: '4k', label: '4K', desc: 'Ultra HD' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id as any)}
                    className={`py-1 px-2 rounded-xl border text-center cursor-pointer transition-all ${preset === p.id ? 'bg-primary/15 border-primary text-white' : 'bg-bg-dark border-border-dark text-gray-400 hover:text-white'}`}
                  >
                    <div className="text-[11px] font-bold">{p.label}</div>
                    <div className="text-[8px] text-gray-500 font-mono">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            {loading ? (
              <button
                onClick={handleCancel}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/10 cursor-pointer transition-all animate-pulse"
              >
                <XCircle className="w-3.5 h-3.5" />
                Hủy quá trình chuyển đổi (Cancel)
              </button>
            ) : (
              <button
                onClick={handleConvert}
                disabled={!videoFile || (splitEnabled && !splitValid)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer ${(!videoFile || (splitEnabled && !splitValid)) ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'}`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Bắt đầu chuyển đổi dọc 9:16
              </button>
            )}
          </div>
        </div>

        {/* Right Info and Result Panel (2/5 cols) */}
        <div className="md:col-span-2 flex flex-col justify-between overflow-y-auto space-y-3 max-h-full min-h-0">
          
          {/* WYSIWYG Layout Preview (v1.8) */}
          <div className="bg-bg-panel border border-border-dark p-3.5 rounded-2xl shadow-lg flex flex-col items-center space-y-2">
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider border-b border-border-dark pb-1.5 w-full text-center">
              Xem trước bố cục dọc (Layout Preview)
            </h3>
            
            <div className="w-[158px] h-[280px] bg-[#0c0c0e] rounded-[1.5rem] border-[4px] border-gray-800 shadow-2xl relative overflow-hidden select-none shrink-0">
              {/* Video Area representing background */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-[#0e0e11] to-purple-950/20 flex flex-col items-center justify-center">
                <div className="w-full h-[88px] bg-gray-900/60 border-y border-white/5 flex items-center justify-center text-[8px] text-gray-500 font-mono">
                  [ Video fit ngang ]
                </div>
              </div>

              {/* Top Title Area - Absolute Position */}
              <div 
                className="absolute w-full bg-black/45 backdrop-blur-[1px] px-2 py-0.5 flex items-center justify-center text-center font-bold leading-tight overflow-hidden break-words border-y border-white/5 font-sans"
                style={{ 
                  top: `${titleYPercent}%`, 
                  transform: 'translateY(-50%)',
                  fontSize: `${Math.max(7, titleFontSize * 280 / 1920)}px`,
                  color: titleColor
                }}
              >
                {title ? title : "TIÊU ĐỀ VIDEO"}
              </div>

              {/* Bottom Subtitle Area - Absolute Position */}
              <div 
                className="absolute w-full bg-black/45 backdrop-blur-[1px] px-2 py-0.5 flex items-center justify-center text-center font-bold leading-tight overflow-hidden break-words font-sans"
                style={{ 
                  bottom: `${subtitleMarginV * 280 / 1920}px`, 
                  transform: 'translateX(-50%)',
                  left: '50%',
                  fontSize: `${Math.max(7, subtitleFontSize * 280 / 1920)}px`,
                  color: subtitleColor
                }}
              >
                {srtFile ? "Dòng phụ đề ví dụ..." : "Không dùng phụ đề"}
              </div>
            </div>
          </div>

          {/* Rules Info */}
          <div className="bg-bg-panel border border-border-dark p-3.5 rounded-2xl shadow-lg space-y-1.5">
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider border-b border-border-dark pb-1">
              Quy tắc bố cục dọc
            </h3>
            <ul className="text-[10px] text-gray-400 space-y-1 leading-relaxed list-disc pl-4 font-sans">
              <li><strong>Top Y</strong>: Tiêu đề tĩnh đè trên nền blur.</li>
              <li><strong>Center</strong>: Video gốc scale fit width, căn giữa.</li>
              <li><strong>Bottom Margin</strong>: Phụ đề chạy đồng bộ.</li>
              <li><strong>Nền Video</strong>: Scale cover-fit + blur + tối mờ 30%.</li>
            </ul>
          </div>

          {/* Convert Results */}
          {(result || loading) && (
            <div className="bg-bg-panel border border-border-dark p-3.5 rounded-2xl shadow-lg space-y-3 animate-in fade-in duration-200">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-wider border-b border-border-dark pb-1">
                Trạng thái tiến trình
              </h3>

              {loading && (
                <div className="space-y-2 py-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400 font-semibold flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      {segmentIndex && segmentCount ? `Đang tạo đoạn ${segmentIndex}/${segmentCount}...` : 'Đang xuất video...'}
                      {progress !== null ? ` ${progress}%` : ''}
                    </span>
                    {progress !== null && eta && (
                      <span className="text-[10px] text-gray-500 font-mono">ETA: {eta}</span>
                    )}
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div className="w-full h-1.5 bg-bg-dark border border-border-dark/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${progress !== null ? progress : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-2">
                  {result.success ? (
                    <>
                      <div className="bg-green-500/10 border border-green-500/15 text-green-400 text-[11px] p-2.5 rounded-xl flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400 mt-0.5" />
                        <div>
                          <span className="font-semibold block">Chuyển đổi thành công!</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Đã tạo xong {result.outputPaths?.length || 0} video dọc 9:16.
                          </span>
                          {result.outputPaths && result.outputPaths.length > 0 && (
                            <div className="mt-1.5 max-h-[80px] overflow-y-auto space-y-1 font-mono text-[9px] text-gray-500">
                              {result.outputPaths.map((p) => (
                                <div key={p} className="truncate" title={p}>{p}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={handleOpenFolder}
                        className="w-full py-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Mở thư mục chứa file
                      </button>
                    </>
                  ) : (
                    <div className="bg-red-950/20 border border-red-500/10 text-red-400 text-[11px] p-2.5 rounded-xl flex items-start gap-2">
                      <XCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Lỗi tiến trình:</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5 leading-relaxed">
                          {result.error}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
