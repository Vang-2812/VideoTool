import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  FolderOpen, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  FileImage,
  Music,
  Volume2,
  Trash2,
  Plus,
  Mic
} from 'lucide-react';

export default function ImportScreen() {
  const { 
    importDirectory, 
    files, 
    skipped, 
    lastImageStartTime, 
    directoryPath, 
    setStep,
    voiceAudio,
    sfxPool,
    addVoiceAudio,
    removeVoiceAudio,
    addSfxFiles,
    removeSfxFile
  } = useProject();

  const [loading, setLoading] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      await importDirectory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVoice = async () => {
    try {
      const file = await window.electronAPI.selectAudioFile();
      if (file) {
        const res = await addVoiceAudio(file.path, file.name);
        if (!res.success) {
          alert(res.error || 'Lỗi khi import file voice chính.');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectSfx = async () => {
    try {
      const selected = await window.electronAPI.selectSfxFiles();
      if (selected && selected.length > 0) {
        const res = await addSfxFiles(selected);
        if (res.success) {
          let alertMsg = `Đã import thành công ${res.addedCount} tệp SFX.`;
          if (res.duplicates.length > 0) {
            alertMsg += `\nĐã bỏ qua ${res.duplicates.length} tệp trùng lặp: ${res.duplicates.join(', ')}`;
          }
          if (res.skipped.length > 0) {
            alertMsg += `\nĐã bỏ qua ${res.skipped.length} tệp không đọc được độ dài: ${res.skipped.join(', ')}`;
          }
          if (res.duplicates.length > 0 || res.skipped.length > 0) {
            alert(alertMsg);
          }
        } else {
          alert(res.error || 'Lỗi khi import danh sách SFX.');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] py-8">
      <div className="glass-panel p-8 rounded-2xl max-w-3xl w-full shadow-2xl transition-all border border-border-dark">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <FolderOpen className="text-primary w-6 h-6" />
          Bước 1: Import Tài Nguyên Dự Án
        </h2>
        <p className="text-sm text-gray-400 mb-8">
          Chọn thư mục chứa ảnh storyboard và thêm các tệp âm thanh (tùy chọn) để làm thuyết minh và hiệu ứng.
        </p>

        {!directoryPath ? (
          <div 
            onClick={handleSelectFolder}
            className="border-2 border-dashed border-border-dark hover:border-primary/50 bg-bg-panel hover:bg-bg-panel/80 p-12 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group"
          >
            <div className="w-16 h-16 bg-primary/10 group-hover:bg-primary/20 rounded-full flex items-center justify-center mb-4 transition-all">
              <FolderOpen className="w-8 h-8 text-primary group-hover:text-primary-light transition-all" />
            </div>
            <span className="text-white font-medium mb-1">
              {loading ? 'Đang đọc thư mục...' : 'Chọn thư mục ảnh Storyboard'}
            </span>
            <span className="text-xs text-gray-500">Hỗ trợ tệp PNG, JPG/JPEG</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Folder Info */}
            <div className="bg-bg-dark border border-border-dark p-4 rounded-xl flex items-center justify-between">
              <div className="overflow-hidden mr-4">
                <span className="text-xs text-gray-500 block">Thư mục storyboard đã chọn</span>
                <span className="text-sm font-mono text-accent truncate block">{directoryPath}</span>
              </div>
              <button 
                onClick={handleSelectFolder}
                className="text-xs text-gray-400 hover:text-white underline cursor-pointer shrink-0"
              >
                Thay đổi
              </button>
            </div>

            {/* Audio configuration grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-b border-border-dark py-6">
              
              {/* Section 1: Audio Voice chính */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-primary" />
                  Audio Thuyết Minh / Voice chính (Tùy chọn)
                </label>

                {!voiceAudio ? (
                  <button
                    onClick={handleSelectVoice}
                    className="w-full py-6 border border-dashed border-border-dark hover:border-primary/40 bg-bg-card/30 hover:bg-bg-card/50 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-white transition-all text-xs"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    Chọn tệp Audio (.mp3, .wav)
                    <span className="text-[10px] text-gray-600 font-mono">Tối đa 1 tệp full-length</span>
                  </button>
                ) : (
                  <div className="bg-bg-card/60 border border-border-dark p-4 rounded-xl flex items-center justify-between">
                    <div className="overflow-hidden mr-4">
                      <span className="text-[10px] text-primary-light font-mono block">Voice Audio</span>
                      <span className="text-xs font-semibold text-white truncate block" title={voiceAudio.name}>
                        {voiceAudio.name}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">Duration: {formatTime(voiceAudio.duration)}</span>
                    </div>
                    <button
                      onClick={removeVoiceAudio}
                      className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 cursor-pointer transition-colors"
                      title="Xóa tệp audio chính"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Pool Sound Effects */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-primary" />
                    Sound Effects Pool (Tùy chọn)
                  </label>
                  {sfxPool.length > 0 && (
                    <button 
                      onClick={handleSelectSfx}
                      className="text-[10px] text-primary hover:text-primary-light flex items-center gap-0.5 cursor-pointer font-semibold"
                    >
                      <Plus className="w-3 h-3" /> Thêm tệp
                    </button>
                  )}
                </div>

                {sfxPool.length === 0 ? (
                  <button
                    onClick={handleSelectSfx}
                    className="w-full py-6 border border-dashed border-border-dark hover:border-primary/40 bg-bg-card/30 hover:bg-bg-card/50 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-white transition-all text-xs"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    Chọn các tệp SFX (.mp3, .wav)
                    <span className="text-[10px] text-gray-600 font-mono">Hỗ trợ import nhiều tệp cùng lúc</span>
                  </button>
                ) : (
                  <div className="border border-border-dark rounded-xl bg-bg-card/20 overflow-hidden max-h-[96px] overflow-y-auto custom-scrollbar">
                    <div className="divide-y divide-border-dark/60">
                      {sfxPool.map((sfx, idx) => (
                        <div key={sfx.path} className="px-3 py-2 flex items-center justify-between text-xs hover:bg-bg-dark/40">
                          <div className="overflow-hidden mr-3">
                            <span className="text-white truncate block font-mono text-[11px]" title={sfx.name}>
                              {idx + 1}. {sfx.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-gray-500 font-mono">{formatTime(sfx.duration)}</span>
                            <button
                              onClick={() => removeSfxFile(sfx.path)}
                              className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-panel/50 p-4 rounded-xl border border-border-dark flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-accent shrink-0" />
                <div>
                  <span className="text-2xl font-bold text-white block">{files.length}</span>
                  <span className="text-xs text-gray-400">Ảnh hợp lệ</span>
                </div>
              </div>
              
              <div className="bg-bg-panel/50 p-4 rounded-xl border border-border-dark flex items-center gap-3">
                <AlertTriangle className={`w-8 h-8 shrink-0 ${skipped.length > 0 ? 'text-yellow-500' : 'text-gray-600'}`} />
                <div>
                  <span className="text-2xl font-bold text-white block">{skipped.length}</span>
                  <span className="text-xs text-gray-400">Tệp bị bỏ qua</span>
                </div>
              </div>
            </div>

            {/* Recommendation Alert */}
            {files.length > 0 && !voiceAudio && (
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-xs text-gray-300">
                <p className="flex items-center gap-2 font-medium text-primary-light mb-1">
                  <FileImage className="w-4 h-4" />
                  Gợi ý tổng thời lượng video
                </p>
                Ảnh cuối cùng bắt đầu tại <strong className="text-white">{Math.floor(lastImageStartTime / 60)}m {lastImageStartTime % 60}s ({lastImageStartTime}s)</strong>. 
                Bạn nên nhập tổng thời lượng video <strong className="text-white">≥ {lastImageStartTime + 1} giây</strong> để đảm bảo ảnh cuối cùng có thời gian hiển thị.
              </div>
            )}

            {/* Voice Audio Loaded Alert */}
            {files.length > 0 && voiceAudio && (
              <div className="bg-accent/5 border border-accent/25 p-4 rounded-xl text-xs text-gray-300">
                <p className="flex items-center gap-2 font-medium text-accent mb-1">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  Đồng bộ thời lượng theo Audio chính (Voice Audio)
                </p>
                Độ dài video tự động khóa ở mức <strong className="text-white">{formatTime(voiceAudio.duration)} ({voiceAudio.duration.toFixed(1)}s)</strong> khớp 100% với tệp thuyết minh chính.
              </div>
            )}

            {/* Skipped files expandable */}
            {skipped.length > 0 && (
              <div className="border border-border-dark rounded-xl overflow-hidden bg-bg-panel/20">
                <button 
                  onClick={() => setShowSkipped(!showSkipped)}
                  className="w-full px-4 py-3 text-left text-xs font-semibold text-gray-400 flex items-center justify-between hover:bg-bg-panel/30 cursor-pointer"
                >
                  <span>Chi tiết tệp bị bỏ qua ({skipped.length})</span>
                  {showSkipped ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showSkipped && (
                  <div className="px-4 pb-3 max-h-32 overflow-y-auto border-t border-border-dark pt-2 space-y-1.5 divide-y divide-border-dark/50">
                    {skipped.map((skip, i) => (
                      <div key={i} className="text-[11px] pt-1.5 flex justify-between gap-4">
                        <span className="text-gray-400 truncate font-mono">{skip.name}</span>
                        <span className="text-yellow-500 shrink-0">{skip.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Button */}
            {files.length > 0 ? (
              <button 
                onClick={() => setStep('preview')}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer group"
              >
                Tiếp tục xem timeline
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="text-center py-2 text-xs text-red-400">
                Chặn tiếp tục: Không tìm thấy ảnh storyboard hợp lệ nào trong thư mục.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
