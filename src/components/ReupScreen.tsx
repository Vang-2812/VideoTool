import React, { useState, useEffect } from 'react';
import {
  Video,
  Upload,
  Languages,
  Wand2,
  Play,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings2,
  Music,
  Eye,
  Volume2
} from 'lucide-react';
import VideoMaskCanvas, { type MaskBox } from './VideoMaskCanvas';

const LANGUAGES = [
  { code: 'en', label: 'Tiếng Anh (English)' },
  { code: 'vi', label: 'Tiếng Việt (Vietnamese)' },
  { code: 'zh', label: 'Tiếng Trung (Chinese)' },
  { code: 'ja', label: 'Tiếng Nhật (Japanese)' },
  { code: 'ko', label: 'Tiếng Hàn (Korean)' }
];

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  translated: string;
}

const REUP_VOICES: Record<string, { id: string; label: string; gender: string }[]> = {
  vi: [
    { id: 'Aoede', label: 'Aoede (Giọng Nữ thanh, Truyền cảm)', gender: 'female' },
    { id: 'Charon', label: 'Charon (Giọng Nam trầm, Điềm đạm)', gender: 'male' },
    { id: 'Puck', label: 'Puck (Giọng Nam ấm, Tự nhiên)', gender: 'male' }
  ],
  en: [
    { id: 'Aoede', label: 'Aoede (Female - Clear & Expressive)', gender: 'female' },
    { id: 'Charon', label: 'Charon (Male - Deep & Calm)', gender: 'male' },
    { id: 'Puck', label: 'Puck (Male - Warm & Natural)', gender: 'male' }
  ],
  zh: [
    { id: 'Aoede', label: 'Aoede (Female - Standard Chinese)', gender: 'female' },
    { id: 'Charon', label: 'Charon (Male - Standard Chinese)', gender: 'male' },
    { id: 'Puck', label: 'Puck (Male - Natural Warm)', gender: 'male' }
  ],
  ja: [
    { id: 'Aoede', label: 'Aoede (Female - Clear Japanese)', gender: 'female' },
    { id: 'Charon', label: 'Charon (Male - Calming Japanese)', gender: 'male' },
    { id: 'Puck', label: 'Puck (Male - Natural Japanese)', gender: 'male' }
  ],
  ko: [
    { id: 'Aoede', label: 'Aoede (Female - Clear Korean)', gender: 'female' },
    { id: 'Charon', label: 'Charon (Male - Calming Korean)', gender: 'male' },
    { id: 'Puck', label: 'Puck (Male - Natural Korean)', gender: 'male' }
  ]
};

export default function ReupScreen() {
  const [videoFile, setVideoFile] = useState<{ path: string; name: string } | null>(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('vi');
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'deepseek'>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('https://api.deepseek.com/v1');

  // Step 1 State
  const [isExtracting, setIsExtracting] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  
  // Step 2 State
  const [blurMask, setBlurMask] = useState<MaskBox>({ x: 10, y: 80, w: 80, h: 15 });
  const [enableVignette, setEnableVignette] = useState(true);
  const [enableFlip, setEnableFlip] = useState(false);
  const [enableZoom, setEnableZoom] = useState(true);

  // Audio & Subtitle State
  const [bgmFile, setBgmFile] = useState<{ path: string; name: string } | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.3);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitlePos, setSubtitlePos] = useState<'bottom' | 'center' | 'top'>('bottom');
  const [enableTts, setEnableTts] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('Aoede');

  // Execution State
  const [isRendering, setIsRendering] = useState(false);
  const [result, setResult] = useState<{ success: boolean; outputPath?: string; error?: string } | null>(null);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderEta, setRenderEta] = useState('--:--');

  // Load settings on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('reup_provider');
    const savedApiKey = localStorage.getItem('reup_api_key');
    const savedEndpoint = localStorage.getItem('reup_endpoint_url');
    const savedEnableTts = localStorage.getItem('reup_enable_tts') === 'true';
    const savedTtsVoice = localStorage.getItem('reup_tts_voice');

    if (savedProvider) setProvider(savedProvider as any);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedEndpoint) setEndpointUrl(savedEndpoint);
    setEnableTts(savedEnableTts);
    if (savedTtsVoice) setTtsVoice(savedTtsVoice);
  }, []);

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem('reup_provider', provider);
    localStorage.setItem('reup_api_key', apiKey);
    localStorage.setItem('reup_endpoint_url', endpointUrl);
    localStorage.setItem('reup_enable_tts', String(enableTts));
    localStorage.setItem('reup_tts_voice', ttsVoice);
  }, [provider, apiKey, endpointUrl, enableTts, ttsVoice]);

  // Adjust default voice if target language changes
  useEffect(() => {
    const voices = REUP_VOICES[targetLang] || [];
    if (voices.length > 0 && !voices.some(v => v.id === ttsVoice)) {
      setTtsVoice(voices[0].id);
    }
  }, [targetLang]);

  // Listen to render progress
  useEffect(() => {
    if (isRendering || autoStatus) {
      const unsubscribe = window.electronAPI.onReupRenderProgress((data) => {
        setRenderProgress(data.progress);
        setRenderEta(data.eta);
      });
      return () => {
        unsubscribe();
      };
    } else {
      setRenderProgress(0);
      setRenderEta('--:--');
    }
  }, [isRendering, autoStatus]);

  const handleSelectVideo = async () => {
    try {
      const res = await window.electronAPI.selectVideoFile();
      if (res) {
        setVideoFile(res);
      }
    } catch (err) {
      console.error('Failed to select video:', err);
    }
  };

  const handleSelectBgm = async () => {
    try {
      const res = await window.electronAPI.selectAudioFile();
      if (res) {
        setBgmFile(res);
      }
    } catch (err) {
      console.error('Failed to select BGM:', err);
    }
  };

  const handleExtractAndTranslate = async () => {
    if (!videoFile) return;
    setIsExtracting(true);
    try {
      const isCloud = provider === 'openai';
      const whisperRes = await window.electronAPI.extractVideoSpeech({
        videoPath: videoFile.path,
        useCloud: isCloud
      });

      if (!whisperRes.success || !whisperRes.segments) {
        alert(whisperRes.error || 'Lỗi khi trích xuất giọng nói từ video.');
        return;
      }

      const res = await window.electronAPI.translateSegments({
        segments: whisperRes.segments,
        sourceLang,
        targetLang,
        provider,
        apiKey,
        endpointUrl
      });

      if (res.success && res.segments) {
        setSegments(res.segments);
      } else {
        alert(res.error || 'Lỗi khi dịch thuật.');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAutoComplete = async () => {
    if (!videoFile) return;
    setAutoStatus('Đang trích xuất giọng nói từ video (Bước 1/3)...');
    try {
      const isCloud = provider === 'openai';
      const whisperRes = await window.electronAPI.extractVideoSpeech({
        videoPath: videoFile.path,
        useCloud: isCloud
      });

      if (!whisperRes.success || !whisperRes.segments) {
        alert(whisperRes.error || 'Lỗi khi trích xuất giọng nói.');
        setAutoStatus(null);
        return;
      }

      setAutoStatus('Đang dịch thuật kịch bản bằng AI (Bước 2/3)...');
      const transRes = await window.electronAPI.translateSegments({
        segments: whisperRes.segments,
        sourceLang,
        targetLang,
        provider,
        apiKey,
        endpointUrl
      });

      if (!transRes.success || !transRes.segments) {
        alert(transRes.error || 'Lỗi khi dịch thuật.');
        setAutoStatus(null);
        return;
      }
      setSegments(transRes.segments);

      let voiceoverSegments = undefined;
      if (enableTts && transRes.segments.length > 0) {
        setAutoStatus('Đang tạo giọng đọc lồng tiếng AI (TTS)...');
        const voiceoverRes = await window.electronAPI.generateReupVoiceover({
          segments: transRes.segments,
          targetLang,
          voiceName: ttsVoice
        });
        if (voiceoverRes.success && voiceoverRes.voiceoverSegments) {
          voiceoverSegments = voiceoverRes.voiceoverSegments;
        } else {
          alert('Lỗi tạo giọng đọc lồng tiếng AI: ' + (voiceoverRes.error || 'Unknown error'));
          setAutoStatus(null);
          return;
        }
      }

      setAutoStatus('Vui lòng chọn nơi lưu tệp video kết quả (Bước 3/3)...');
      const savePath = await window.electronAPI.selectSavePath('reup_video.mp4');
      if (!savePath) {
        setAutoStatus(null);
        return;
      }

      setAutoStatus('Đang render video reup hoàn chỉnh...');
      const renderRes = await window.electronAPI.renderReupVideo({
        videoPath: videoFile.path,
        blurMask,
        enableVignette,
        enableFlip,
        enableZoom,
        bgmAudioPath: bgmFile?.path,
        bgmVolume,
        outputPath: savePath,
        segments: transRes.segments,
        showSubtitles,
        subtitlePos,
        voiceoverSegments
      });

      setResult(renderRes);
    } catch (err: any) {
      alert('Lỗi khi tự động hoàn thành: ' + err.message);
    } finally {
      setAutoStatus(null);
    }
  };

  const handleRenderReup = async () => {
    if (!videoFile) return;
    setIsRendering(true);
    setResult(null);

    try {
      let voiceoverSegments = undefined;
      if (enableTts && segments.length > 0) {
        const voiceoverRes = await window.electronAPI.generateReupVoiceover({
          segments,
          targetLang,
          voiceName: ttsVoice
        });
        if (voiceoverRes.success && voiceoverRes.voiceoverSegments) {
          voiceoverSegments = voiceoverRes.voiceoverSegments;
        } else {
          alert('Lỗi tạo giọng đọc lồng tiếng AI: ' + (voiceoverRes.error || 'Unknown error'));
          setIsRendering(false);
          return;
        }
      }

      const savePath = await window.electronAPI.selectSavePath('reup_video.mp4');
      if (!savePath) {
        setIsRendering(false);
        return;
      }

      const res = await window.electronAPI.renderReupVideo({
        videoPath: videoFile.path,
        blurMask,
        enableVignette,
        enableFlip,
        enableZoom,
        bgmAudioPath: bgmFile?.path,
        bgmVolume,
        outputPath: savePath,
        segments,
        showSubtitles,
        subtitlePos,
        voiceoverSegments
      });

      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 h-full items-start">
      {/* Left Column: Input Configurations & Step 1 (3/5 cols) */}
      <div className="lg:col-span-3 bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
          <Video className="w-4 h-4 text-primary" />
          Reup Video & Lồng Tiếng Tự Động
        </h2>

        {/* Video Input Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 block">Tệp Video Nguồn (Vuông 1:1 hoặc Dọc 9:16)</label>
          <div className="flex gap-3">
            <button
              onClick={handleSelectVideo}
              className="px-4 py-2 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              Chọn Video
            </button>
            <div className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 flex items-center overflow-hidden">
              {videoFile ? (
                <span className="text-xs text-accent font-mono truncate">{videoFile.name}</span>
              ) : (
                <span className="text-xs text-gray-500 italic">Chưa chọn video nguồn nào...</span>
              )}
            </div>
          </div>
        </div>

        {/* Languages & AI Engine Setup */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-dark/60">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400">Ngôn ngữ gốc</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400">Ngôn ngữ Reup</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* AI Translation Engine Choice */}
        <div className="space-y-3 pt-2 border-t border-border-dark/60">
          <label className="text-xs font-semibold text-gray-400 block">Công cụ AI Dịch Thuật</label>
          <div className="grid grid-cols-3 gap-2">
            {(['gemini', 'openai', 'deepseek'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${provider === p ? 'bg-primary/10 border-primary text-white' : 'bg-bg-card border-border-dark text-gray-400'}`}
              >
                {p === 'deepseek' ? 'DeepSeek Flash' : p}
              </button>
            ))}
          </div>

          {/* DeepSeek Specific Credentials */}
          {provider === 'deepseek' && (
            <div className="bg-bg-dark border border-border-dark p-3.5 rounded-xl space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">API Key DeepSeek</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-bg-card border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Endpoint URL Custom</label>
                <input
                  type="text"
                  placeholder="https://api.deepseek.com/v1"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="w-full bg-bg-card border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 1 Execute Button */}
        <div className="pt-2">
          <button
            disabled={!videoFile || isExtracting}
            onClick={handleExtractAndTranslate}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${!videoFile || isExtracting ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-white shadow-accent/20'}`}
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang trích xuất & dịch thuật AI...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Bước 1: Trích xuất Lời nói & Dịch thuật
              </>
            )}
          </button>
        </div>

        {/* Editable Transcript Table */}
        {segments.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Kịch bản dịch thuật (Review & Edit)</h3>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {segments.map((seg, idx) => (
                <div key={seg.id} className="bg-bg-dark border border-border-dark p-2.5 rounded-xl space-y-1.5">
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>#{idx + 1} ({seg.start}s - {seg.end}s)</span>
                    <span className="text-gray-400 italic">Gốc: {seg.text}</span>
                  </div>
                  <textarea
                    value={seg.translated}
                    onChange={(e) => {
                      const updated = [...segments];
                      updated[idx].translated = e.target.value;
                      setSegments(updated);
                    }}
                    className="w-full bg-bg-card border border-border-dark text-gray-200 p-2 rounded-lg text-xs outline-none focus:border-primary font-sans"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Step 2 Anti-Copyright, Visual Mask & Render (2/5 cols) */}
      <div className="lg:col-span-2 space-y-5 bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-border-dark pb-2 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-accent" />
          Bước 2: Cấu Hình Reup & Anti-Copyright
        </h3>

        {/* Interactive Bounding Box Video Mask Canvas */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-gray-400 block">Vùng làm mờ phụ đề gốc (Kéo thả trên màn hình)</span>
          {videoFile ? (
            <VideoMaskCanvas
              videoUrl={videoFile.path}
              mask={blurMask}
              onChange={setBlurMask}
            />
          ) : (
            <div className="w-full aspect-[9/16] max-h-[220px] bg-bg-dark rounded-xl border border-border-dark flex items-center justify-center text-xs text-gray-500 italic">
              Chọn video để kích hoạt xem trước vùng mờ...
            </div>
          )}
        </div>

        {/* Anti-Copyright Visual Filters */}
        <div className="space-y-2 pt-2 border-t border-border-dark/60">
          <label className="text-xs font-semibold text-gray-400 block">Hiệu ứng lách bản quyền Visual</label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableVignette}
                onChange={(e) => setEnableVignette(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              Làm tối viền video (Vignette)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableFlip}
                onChange={(e) => setEnableFlip(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              Lật ngược hình ảnh (Mirror / Flip)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableZoom}
                onChange={(e) => setEnableZoom(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              Thu nhỏ / Zoom nhẹ (Subtle Crop 96%)
            </label>
          </div>
        </div>

        {/* Background Music & Volume Mix */}
        <div className="space-y-2 pt-2 border-t border-border-dark/60">
          <label className="text-xs font-semibold text-gray-400 block">Nhạc nền (BGM)</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectBgm}
              className="px-3 py-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 text-xs rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Music className="w-3.5 h-3.5" />
              Chọn Nhạc
            </button>
            <div className="flex-1 bg-bg-dark border border-border-dark rounded-lg px-2.5 py-1.5 flex items-center overflow-hidden">
              <span className="text-[11px] text-gray-400 font-mono truncate">{bgmFile ? bgmFile.name : 'Không dùng BGM'}</span>
            </div>
          </div>
          {bgmFile && (
            <div className="space-y-1 pt-1.5 animate-in fade-in duration-200">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500 font-semibold">Âm lượng BGM</span>
                <span className="font-mono text-primary font-bold">{Math.round(bgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={bgmVolume}
                onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                className="w-full custom-slider cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Subtitle Configuration */}
        <div className="space-y-2.5 pt-2 border-t border-border-dark/60">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400">Hiển thị phụ đề dịch</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showSubtitles}
                onChange={(e) => setShowSubtitles(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-bg-dark border border-border-dark rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
            </label>
          </div>

          {showSubtitles && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-[11px] font-medium text-gray-500 block">Vị trí hiển thị phụ đề</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bottom', 'center', 'top'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setSubtitlePos(pos)}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold capitalize transition-all cursor-pointer ${subtitlePos === pos ? 'bg-primary/10 border-primary text-white font-black' : 'bg-bg-card border-border-dark text-gray-400'}`}
                  >
                    {pos === 'bottom' ? 'Dưới' : pos === 'center' ? 'Giữa' : 'Trên'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TTS Dubbing Configuration */}
        <div className="space-y-2.5 pt-2 border-t border-border-dark/60">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400">Lồng tiếng AI (TTS)</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableTts}
                onChange={(e) => setEnableTts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-bg-dark border border-border-dark rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
            </label>
          </div>

          {enableTts && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-[11px] font-medium text-gray-500 block">Giọng đọc lồng tiếng ({targetLang.toUpperCase()})</label>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              >
                {(REUP_VOICES[targetLang] || []).map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {(isRendering || autoStatus === 'Đang render video reup hoàn chỉnh...') && (
          <div className="space-y-1.5 animate-in fade-in duration-200 bg-bg-dark border border-border-dark p-3.5 rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Đang render video...
              </span>
              <span className="font-mono text-primary font-bold">{renderProgress}% (Còn lại: {renderEta})</span>
            </div>
            <div className="w-full h-2.5 bg-bg-panel border border-border-dark rounded-full overflow-hidden">
              <div
                style={{ width: `${renderProgress}%` }}
                className="h-full bg-primary rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
              />
            </div>
          </div>
        )}

        {/* Render & Auto Buttons */}
        <div className="pt-3 border-t border-border-dark space-y-2">
          {/* One-Click Auto-Complete Button */}
          <button
            disabled={!videoFile || isRendering || !!autoStatus || isExtracting}
            onClick={handleAutoComplete}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${!videoFile || isRendering || !!autoStatus || isExtracting ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-white shadow-accent/20'}`}
          >
            {autoStatus ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{autoStatus}</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Tự Động Hoàn Tất (1-Click Auto)
              </>
            )}
          </button>

          {/* Manual Step 2 Render Button */}
          <button
            disabled={!videoFile || isRendering || !!autoStatus || isExtracting}
            onClick={handleRenderReup}
            className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-border-dark transition-all cursor-pointer ${!videoFile || isRendering || !!autoStatus || isExtracting ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-bg-card hover:bg-bg-dark text-gray-300'}`}
          >
            {isRendering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang Render Video Reup...
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                Render Thủ Công (Bước 2)
              </>
            )}
          </button>
        </div>

        {/* Output status */}
        {result && (
          <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {result.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{result.success ? `Đã xuất video reup thành công: ${result.outputPath}` : result.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
