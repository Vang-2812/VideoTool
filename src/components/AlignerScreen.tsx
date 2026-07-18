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
  const [splitExtendedPunctuation, setSplitExtendedPunctuation] = useState(false);

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
    const savedSplitPunct = localStorage.getItem('aligner_split_extended_punct') === 'true';
    setSplitExtendedPunctuation(savedSplitPunct);
  }, []);

  useEffect(() => {
    localStorage.setItem('aligner_split_extended_punct', String(splitExtendedPunctuation));
  }, [splitExtendedPunctuation]);

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
        srtLevel,
        splitExtendedPunctuation
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

  const handleSaveTimestampText = async () => {
    if (!result?.txtPath) return;
    await window.electronAPI.saveFileFromTemp({
      sourcePath: result.txtPath,
      filterName: 'Timestamp Text',
      extension: 'txt'
    });
  };

  const handlePlayAudio = (filePath: string) => {
    window.electronAPI.playVideo(filePath);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 h-full items-start">
      
      {/* Left Column: Aligner Configuration (3/5 cols) */}
      <div className="lg:col-span-3 bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-5 signature-top-indicator">
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
            <div className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 flex items-center overflow-hidden">
              {audioFile ? (
                <span className="text-xs text-accent font-mono truncate">{audioFile.name}</span>
              ) : (
                <span className="text-xs text-gray-500 italic">Chưa chọn tệp audio nào...</span>
              )}
            </div>
          </div>
        </div>

        {/* Checkboxes for Mode */}
        <div className="space-y-2 pt-1 border-t border-border-dark/60">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={transcribeOnly}
              onChange={(e) => setTranscribeOnly(e.target.checked)}
              className="custom-checkbox-input"
            />
            <span className="text-xs text-gray-300 font-medium">
              Tự động nhận diện phụ đề (Không cần nhập Script kịch bản)
            </span>
          </label>
        </div>

        {/* Script Text Input */}
        {!transcribeOnly && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-400">Kịch bản văn bản (Script)</label>
              <label className="bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Import file .txt
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleImportTxt}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              placeholder="Dán hoặc nhập toàn bộ nội dung kịch bản tương ứng với file audio ở đây..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white p-4 rounded-xl text-xs min-h-[140px] outline-none transition-colors font-sans leading-relaxed"
            />
          </div>
        )}

        {/* Subtitle Granularity Options */}
        <div className="space-y-2 pt-1 border-t border-border-dark/60">
          <label className="text-xs font-semibold text-gray-400 block">Cấp độ xuất phụ đề (Subtitles Level)</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSrtLevel('sentence')}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${srtLevel === 'sentence' ? 'bg-primary/10 border-primary text-white' : 'bg-bg-card border-border-dark text-gray-400 hover:border-gray-500'}`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                Từng câu (Sentence)
                {srtLevel === 'sentence' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Tự động gộp thành câu hoàn chỉnh dễ đọc.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSrtLevel('word')}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${srtLevel === 'word' ? 'bg-primary/10 border-primary text-white' : 'bg-bg-card border-border-dark text-gray-400 hover:border-gray-500'}`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                Từng từ (Word)
                {srtLevel === 'word' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Mỗi từ là một mốc thời gian riêng biệt.
              </div>
            </button>
          </div>

          {srtLevel === 'sentence' && !transcribeOnly && (
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer mt-2 pl-1 select-none">
              <input
                type="checkbox"
                checked={splitExtendedPunctuation}
                onChange={(e) => setSplitExtendedPunctuation(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span>Tách thêm câu theo dấu phẩy (,) và dấu nháy (', ")</span>
            </label>
          )}
        </div>

        {/* Decoder Options */}
        <div className="space-y-2 pt-1 border-t border-border-dark/60">
          <label className="text-xs font-semibold text-gray-400 block">Phương thức giải mã (Whisper Decoder)</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setUseCloud(false)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${!useCloud ? 'bg-primary/10 border-primary text-white' : 'bg-bg-card border-border-dark text-gray-400 hover:border-gray-500'}`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                Whisper Local
                {!useCloud && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {whisperReady ? 'Đã cài đặt sẵn (Miễn phí, Chạy trên máy)' : 'Chưa tải (Cần tải bộ cài ~140MB)'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUseCloud(true)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${useCloud ? 'bg-primary/10 border-primary text-white' : 'bg-bg-card border-border-dark text-gray-400 hover:border-gray-500'}`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                OpenAI Cloud API
                {useCloud && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {openaiKeyExists ? 'Đã cấu hình API Key' : 'Chưa có API Key (Vào Cài đặt)'}
              </div>
            </button>
          </div>
        </div>

        {/* Execute Button */}
        <div className="border-t border-border-dark pt-4 flex justify-end">
          <button
            disabled={loading || !audioFile || (!transcribeOnly && !text.trim())}
            onClick={handleAlign}
            className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${loading || !audioFile || (!transcribeOnly && !text.trim()) ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang xử lý phụ đề...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                Tạo phụ đề SRT
              </>
            )}
          </button>
        </div>

        {/* Local Whisper Setup Section */}
        {!whisperReady && !useCloud && (
          <div className="bg-bg-dark border border-border-dark p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Chưa tìm thấy công cụ Whisper Local trên máy tính.
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Bạn có thể nhấn nút bên dưới để tự động tải về bộ giải mã Whisper Local (Dung lượng khoảng 140MB). Chỉ cần tải 1 lần duy nhất để sử dụng offline mãi mãi.
            </p>

            {isSettingUpWhisper ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>{setupStatus}</span>
                  <span className="font-mono">{setupPercent}%</span>
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

      {/* Right Column: Results & Status Info (2/5 cols) */}
      <div className="lg:col-span-2 space-y-6">

        {/* Default Whisper Status & Guide Card when no output yet */}
        {!result && !error && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 signature-top-indicator">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-border-dark pb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              Trạng Thái Giải Mã & Hướng Dẫn
            </h3>

            {/* Local Whisper Status Card */}
            <div className="bg-bg-dark border border-border-dark p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <span className={`w-2.5 h-2.5 rounded-full ${whisperReady ? 'bg-accent animate-pulse' : 'bg-yellow-500'}`}></span>
                Bộ giải mã Whisper Local (ggml-base)
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {whisperReady
                  ? 'Đã sẵn sàng hoạt động offline trên máy tính mà không cần kết nối mạng internet.'
                  : 'Chưa tìm thấy bộ cài offline. Nhấn nút bên dưới để tải về (~140MB).'}
              </p>

              {!whisperReady && !useCloud && (
                isSettingUpWhisper ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-300">
                      <span>{setupStatus}</span>
                      <span className="font-mono">{setupPercent}%</span>
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
                )
              )}
            </div>

            {/* Instructions list */}
            <div className="space-y-2.5 text-xs text-gray-400 leading-relaxed pt-1">
              <div className="bg-bg-dark border border-border-dark p-3 rounded-xl space-y-1">
                <span className="font-semibold text-white block">Tùy chọn Từng câu (Sentence)</span>
                <p className="text-[11px]">Gộp các từ khớp với kịch bản văn bản thành câu hoàn chỉnh 1-đến-1.</p>
              </div>
              <div className="bg-bg-dark border border-border-dark p-3 rounded-xl space-y-1">
                <span className="font-semibold text-white block">Tùy chọn Từng từ (Word)</span>
                <p className="text-[11px]">Mỗi từ hiển thị mốc thời gian riêng cho các hiệu ứng karaoke/doodle.</p>
              </div>
            </div>
          </div>
        )}

        {(result || error) && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-250 signature-top-indicator">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  {audioFile && (
                    <button
                      onClick={() => handlePlayAudio(audioFile.path)}
                      className="py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Nghe thử
                    </button>
                  )}
                  <button
                    onClick={handleSaveSrt}
                    className="py-2.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 hover:text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Lưu file SRT
                  </button>
                  <button
                    onClick={handleSaveTimestampText}
                    className="py-2.5 bg-accent/10 hover:bg-accent/25 border border-accent/20 hover:border-accent/45 text-accent text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Lưu Timestamp
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
