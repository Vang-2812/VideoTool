import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Play,
  XCircle,
  FolderOpen
} from 'lucide-react';

interface AlignerScreenProps {
  sharedTtsOutput: { audioPath: string; scriptText: string } | null;
  clearSharedTts: () => void;
}

export default function AlignerScreen({ sharedTtsOutput, clearSharedTts }: AlignerScreenProps) {
  const [audioFile, setAudioFile] = useState<{ path: string; name: string } | null>(null);
  const [text, setText] = useState('');
  const [useCloud, setUseCloud] = useState(false);
  const [transcribeOnly, setTranscribeOnly] = useState(false);
  const [srtLevel, setSrtLevel] = useState<'word' | 'sentence'>('sentence');

  // States
  const [openaiKeyExists, setOpenaiKeyExists] = useState(false);
  const [whisperReady, setWhisperReady] = useState(false);
  const [isSettingUpWhisper, setIsSettingUpWhisper] = useState(false);
  const [setupPercent, setSetupPercent] = useState(0);
  const [setupStatus, setSetupStatus] = useState('');

  // Execution States
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check pre-populated state on mount
  useEffect(() => {
    if (sharedTtsOutput) {
      setAudioFile({
        path: sharedTtsOutput.audioPath,
        name: sharedTtsOutput.audioPath.split(/[\\/]/).pop() || 'tts_voiceover.mp3'
      });
      setText(sharedTtsOutput.scriptText);
      // Clean up after loading so it doesn't re-apply if user navigates away and back
      clearSharedTts();
    }
  }, [sharedTtsOutput]);

  // Load key existence & whisper status on mount
  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const oRes = await window.electronAPI.getApiKey('openai');
      setOpenaiKeyExists(!!(oRes.success && oRes.key));

      const wRes = await window.electronAPI.checkWhisperSetup();
      setWhisperReady(wRes.ready);
    } catch (err) {
      console.error('Failed to check keys/whisper status:', err);
    }
  };

  const handleImportTxt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setText(event.target?.result as string || '');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectAudio = async () => {
    try {
      const res = await window.electronAPI.selectAudioFile();
      if (res) {
        setAudioFile(res);
      }
    } catch (err) {
      console.error('Failed to select audio:', err);
    }
  };

  const handleSetupWhisper = async () => {
    setIsSettingUpWhisper(true);
    setSetupPercent(0);
    setSetupStatus('Khởi động tải bộ giải mã local...');

    let unsubProgress: any = null;

    try {
      unsubProgress = window.electronAPI.onWhisperSetupProgress(({ status, percent }) => {
        setSetupPercent(percent);
        if (status === 'downloading_cli') {
          setSetupStatus(`Đang tải Whisper CLI... (${percent}%)`);
        } else if (status === 'extracting_cli') {
          setSetupStatus('Đang giải nén bộ cài đặt...');
        } else if (status === 'downloading_model') {
          setSetupStatus(`Đang tải Whisper model (~140MB)... (${percent}%)`);
        } else if (status === 'ready') {
          setSetupStatus('Bộ giải mã Whisper local đã sẵn sàng!');
        }
      });

      const res = await window.electronAPI.setupWhisper();
      if (res.success) {
        setWhisperReady(true);
      } else {
        alert(res.error || 'Lỗi tải Whisper.');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      if (unsubProgress) unsubProgress();
      setIsSettingUpWhisper(false);
    }
  };

  const handleAlign = async () => {
    if (!audioFile) {
      alert('Vui lòng chọn tệp Audio.');
      return;
    }
    if (!transcribeOnly && !text.trim()) {
      alert('Vui lòng nhập văn bản kịch bản.');
      return;
    }
    if (useCloud && !openaiKeyExists) {
      alert('Chưa cấu hình OpenAI API Key trong Settings.');
      return;
    }
    if (!useCloud && !whisperReady) {
      alert('Cần chuẩn bị bộ giải mã Whisper local trước khi tạo phụ đề.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const alignRes = await window.electronAPI.alignAudioAndScript({
        audioPath: audioFile.path,
        scriptText: transcribeOnly ? '' : text.trim(),
        useCloud,
        transcribeOnly,
        srtLevel
      });

      if (alignRes.success) {
        setResult(alignRes);
      } else {
        setError(alignRes.error || 'Lỗi khi căn lề phụ đề.');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi hệ thống khi chạy căn lề phụ đề.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSrt = async () => {
    if (!result?.srtPath) return;
    await window.electronAPI.saveFileFromTemp({
      sourcePath: result.srtPath,
      filterName: 'Subtitle SRT',
      extension: 'srt'
    });
  };

  const handlePlayAudio = (filePath: string) => {
    window.electronAPI.playVideo(filePath);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 h-full items-start">
      
      {/* Left Column: Aligner Configuration (3/5 cols) */}
      <div className="lg:col-span-3 bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
          <Volume2 className="w-4 h-4 text-primary" />
          Tạo Phụ Đề (Forced Aligner / Speech-to-Text)
        </h2>

        {/* Audio File Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 block">Tệp âm thanh nguồn (Audio)</label>
          <div className="flex gap-3">
            <button
              onClick={handleSelectAudio}
              className="px-4 py-2 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              Chọn file Audio
            </button>
            <div className="flex-1 bg-bg-dark border border-border-dark/60 rounded-xl px-4 py-2 flex items-center text-xs text-gray-400 font-mono overflow-hidden">
              {audioFile ? (
                <span className="text-white truncate" title={audioFile.path}>{audioFile.name}</span>
              ) : (
                <span className="text-gray-600 italic">Chưa chọn tệp (.mp3, .wav)</span>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Transcribe Only (New v1.7.1) */}
        <div className="bg-bg-dark border border-border-dark/65 p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="transcribeOnlyCheckbox"
              checked={transcribeOnly}
              onChange={(e) => setTranscribeOnly(e.target.checked)}
              className="accent-primary w-4 h-4 cursor-pointer"
            />
            <label htmlFor="transcribeOnlyCheckbox" className="text-xs font-semibold text-gray-200 cursor-pointer select-none">
              Tự động nhận diện phụ đề (Không cần nhập Script kịch bản)
            </label>
          </div>

          {/* Subtitle structure choice */}
          <div className="space-y-2 border-t border-border-dark/40 pt-3">
            <label className="text-xs font-semibold text-gray-400 block">Cấp độ hiển thị phụ đề (SRT Format)</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="radio"
                  name="srtLevel"
                  value="sentence"
                  checked={srtLevel === 'sentence'}
                  onChange={() => setSrtLevel('sentence')}
                  className="accent-primary"
                />
                Từng câu (Sentence) - Khuyên dùng
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="radio"
                  name="srtLevel"
                  value="word"
                  checked={srtLevel === 'word'}
                  onChange={() => setSrtLevel('word')}
                  className="accent-primary"
                />
                Từng từ (Word)
              </label>
            </div>
          </div>
        </div>

        {/* Script text input (Disabled if transcribeOnly is active) */}
        {!transcribeOnly && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-400">Văn bản kịch bản khớp (Script)</label>
              <label className="bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Import từ file .txt
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleImportTxt}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              placeholder="Dán hoặc nhập kịch bản chữ khớp 100% với giọng đọc trong file audio..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white p-4 rounded-xl text-xs min-h-[200px] outline-none transition-colors font-sans leading-relaxed"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>{text.length} ký tự</span>
              <span>{text.split(/\s+/).filter(Boolean).length} từ</span>
            </div>
          </div>
        )}

        {/* Action Button & API Selection */}
        <div className="border-t border-border-dark pt-4 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useCloudAligner"
              checked={useCloud}
              onChange={(e) => setUseCloud(e.target.checked)}
              className="accent-primary"
            />
            <label htmlFor="useCloudAligner" className="text-xs text-gray-300 cursor-pointer select-none">
              Dùng OpenAI Whisper Cloud (Whisper-1 API)
            </label>
          </div>

          <button
            disabled={!audioFile || (!transcribeOnly && !text.trim()) || loading}
            onClick={handleAlign}
            className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${!audioFile || (!transcribeOnly && !text.trim()) || loading ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang chạy căn lề Whisper...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                Tạo phụ đề SRT
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column: Whisper Local Setup and Results (2/5 cols) */}
      <div className="lg:col-span-2 space-y-6">

        {/* Whisper Engine local setup (only shown when not using Cloud) */}
        {!useCloud && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-border-dark pb-2">
              <Download className="w-4 h-4 text-accent" />
              Bộ giải mã Whisper Local
            </h3>

            {whisperReady ? (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/15 border border-green-500/10 p-3 rounded-xl">
                <CheckCircle2 className="w-4.5 h-4.5 text-green-400 shrink-0" />
                <span>Bộ giải mã Whisper (ggml-base) đã sẵn sàng hoạt động ngoại tuyến.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Để tự động align phụ đề SRT cục bộ mà không phát sinh thêm chi phí API, anh cần tải bộ cài đặt Whisper local (~142MB).
                </p>

                {isSettingUpWhisper ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>{setupStatus}</span>
                      <span>{setupPercent}%</span>
                    </div>
                    <div className="w-full bg-bg-dark rounded-full h-2 overflow-hidden border border-border-dark">
                      <div
                        style={{ width: `${setupPercent}%` }}
                        className="bg-accent h-full rounded-full transition-all duration-300"
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSetupWhisper}
                    className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-accent/25 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Tải cài đặt Whisper Local
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results output */}
        {(result || error) && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-250">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-border-dark pb-2">
              Kết quả căn lề (Output)
            </h3>

            {error && (
              <div className="bg-red-950/20 border border-red-500/10 text-red-400 text-xs p-4 rounded-xl flex items-start gap-2">
                <XCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/15 text-green-400 text-xs p-4 rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-green-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Đã tạo phụ đề thành công!</span>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      Độ chính xác đối khớp kịch bản: <strong className="text-white">{result.matchRate.toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>

                {/* Match Rate warning */}
                {result.matchRate < 90 && (
                  <div className="bg-yellow-950/20 border border-yellow-500/20 text-yellow-300 text-[10px] p-3.5 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-yellow-500 mt-0.5" />
                    <span>
                      Độ khớp giữa audio và script khá thấp ({result.matchRate.toFixed(1)}%). Phụ đề word-level có thể không chính xác hoàn toàn ở một số đoạn.
                    </span>
                  </div>
                )}

                {/* Subtitle SRT Preview Box */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-gray-400 block">Xem trước SRT (Preview)</span>
                  <textarea
                    readOnly
                    value={result.srtContent}
                    className="w-full bg-bg-dark border border-border-dark text-gray-300 p-3 rounded-xl text-[10px] min-h-[140px] max-h-[220px] font-mono outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {audioFile && (
                    <button
                      onClick={() => handlePlayAudio(audioFile.path)}
                      className="py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Nghe thử Audio
                    </button>
                  )}
                  <button
                    onClick={handleSaveSrt}
                    className="py-2.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 hover:text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Lưu file SRT
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
