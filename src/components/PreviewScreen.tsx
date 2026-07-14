import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { ArrowLeft, ArrowRight, AlertTriangle, Info, Clock, Volume2, ZoomIn, Shuffle } from 'lucide-react';
import { validateProject } from '../../electron/fileParser.js';
import MockVideoPlayer from './MockVideoPlayer';
import InteractiveTimeline from './InteractiveTimeline';

export default function PreviewScreen() {
  const { 
    files, 
    totalDuration, 
    setTotalDuration, 
    lastImageStartTime, 
    setStep,
    voiceAudio,
    sfxPool,
    reShuffleSfx,
    // v1.3 states and actions
    voiceVolume,
    sfxVolume,
    transitionEnabled,
    transitionType,
    transitionDuration,
    kenBurnsEnabled,
    setVoiceVolume,
    setSfxVolume,
    setTransitionEnabled,
    setTransitionType,
    setTransitionDuration,
    setKenBurnsEnabled,
    reShuffleKenBurns,
    cascadeShift
  } = useProject();

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  
  const selectedFile = useMemo(() => {
    return files.find(f => f.path === selectedFilePath) || files[0] || null;
  }, [files, selectedFilePath]);

  const setSelectedFile = (file: any) => {
    setSelectedFilePath(file ? file.path : null);
  };

  const [durationInput, setDurationInput] = useState(totalDuration.toString());
  const [validation, setValidation] = useState<{ isValid: boolean; error?: string; warning?: string }>({ isValid: true });
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const isVoiceOverridden = !!voiceAudio;

  // Run validation when duration input changes
  useEffect(() => {
    const numericDuration = parseFloat(durationInput);
    if (isNaN(numericDuration) || numericDuration <= 0) {
      setValidation({
        isValid: false,
        error: "Vui lòng nhập một số hợp lệ lớn hơn 0."
      });
      return;
    }

    const valResult = validateProject(files, numericDuration, isVoiceOverridden);
    setValidation(valResult);
    
    if (valResult.isValid && !isVoiceOverridden) {
      setTotalDuration(numericDuration);
    }
  }, [durationInput, files, isVoiceOverridden]);

  // Helper to format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = secs % 1;
    const msStr = ms > 0 ? `.${Math.round(ms * 10)}` : '';
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}${msStr}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationInput(e.target.value);
  };

  // Helper to calculate transition durations client-side (FR-2.5, FR-2.6)
  const calculateTransitions = (filesList: typeof files, T: number) => {
    const n = filesList.length;
    if (n <= 1) return [];
    
    const trans = [];
    
    for (let i = 1; i < n; i++) {
      const d_prev = filesList[i - 1].duration;
      const d_curr = filesList[i].duration;
      
      const limit_prev = (i - 1 === 0) ? d_prev : d_prev / 2;
      const limit_curr = (i === n - 1) ? d_curr : d_curr / 2;
      
      let t_prime = Math.min(T, limit_prev, limit_curr);
      let fallback = false;
      
      if (t_prime < 0.05) {
        t_prime = 0;
        fallback = true;
      }
      
      trans.push({
        duration: t_prime,
        fallbackHardCut: fallback
      });
    }
    
    return trans;
  };

  const boundaryTransitions = useMemo(() => {
    return calculateTransitions(files, transitionDuration);
  }, [files, transitionDuration]);

  // Check if any transition falls back to hard cut
  const hasFallbackTransitions = useMemo(() => {
    return boundaryTransitions.some(t => t.fallbackHardCut);
  }, [boundaryTransitions]);

  return (
    <div className="flex flex-col h-full py-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
      {/* Header and Duration Input */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-panel p-6 rounded-2xl border border-border-dark shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="text-primary w-6 h-6" />
            Bước 2: Preview Timeline & Tổng thời lượng
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Tổng số {files.length} ảnh storyboard. Nhấn vào mỗi ảnh trên timeline để xem chi tiết.
          </p>
        </div>

        {/* Input total duration */}
        <div className="w-full md:w-auto flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-400">
            {isVoiceOverridden ? 'Tổng thời lượng (đã khóa theo voice chính)' : 'Tổng thời lượng video (giây)'}
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              step="0.5"
              disabled={isVoiceOverridden}
              min={lastImageStartTime + 1}
              value={durationInput}
              onChange={handleInputChange}
              className={`bg-bg-dark border ${isVoiceOverridden ? 'text-gray-500 border-border-dark/60 cursor-not-allowed bg-bg-dark/45' : !validation.isValid ? 'border-red-500 text-red-400' : 'border-border-dark text-white focus:border-primary'} px-4 py-2.5 rounded-xl font-mono text-sm w-36 outline-none transition-colors`}
            />
            <span className="text-sm font-mono text-gray-400 bg-bg-dark border border-border-dark px-3 py-2.5 rounded-xl">
              {formatTime(parseFloat(durationInput) || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Overridden duration status text */}
      {isVoiceOverridden && (
        <div className="bg-primary/5 border border-primary/20 text-primary-light px-4 py-3 rounded-xl text-xs flex items-center gap-3">
          <Info className="w-5 h-5 shrink-0" />
          <span>Thời lượng video tự động lấy theo audio chính (<strong>{formatTime(totalDuration)}</strong>). Ô nhập tay bị khóa.</span>
        </div>
      )}

      {/* Validation Error Alert */}
      {!validation.isValid && (
        <div className="bg-red-950/30 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{validation.error}</span>
        </div>
      )}

      {/* Validation Warning Alert */}
      {validation.isValid && validation.warning && (
        <div className="bg-yellow-950/20 border border-yellow-500/20 text-yellow-200 px-4 py-3 rounded-xl text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <span>{validation.warning}</span>
        </div>
      )}

      {/* Single SFX Pool Warning */}
      {sfxPool.length === 1 && (
        <div className="bg-yellow-950/20 border border-yellow-500/20 text-yellow-300 text-xs px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <span><strong>Lưu ý:</strong> Chỉ có 1 sound effect trong pool, SFX này sẽ được dùng lặp lại cho tất cả các vị trí ảnh (FR-3.2.3).</span>
        </div>
      )}

      {/* Transition Fallback warnings (V-1, V-2) */}
      {transitionEnabled && hasFallbackTransitions && (
        <div className="bg-yellow-950/20 border border-yellow-500/20 text-yellow-300 text-xs px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <span>
            <strong>Chú ý:</strong> Một số ảnh quá ngắn khiến hiệu ứng chuyển cảnh bị rút ngắn hoặc fallback về <strong>Hard Cut</strong> (Xem ký hiệu cảnh báo màu vàng/đỏ trên timeline).
          </span>
        </div>
      )}

      {/* New Mock Video Player FR-1 */}
      <MockVideoPlayer />

      {/* Interactive Timeline FR-2 */}
      <InteractiveTimeline 
        selectedFile={selectedFile} 
        setSelectedFile={setSelectedFile} 
        boundaryTransitions={boundaryTransitions} 
      />

      {/* 2. Effects & Audio Settings Panel (FR-4.1 -> FR-4.3) */}
      <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-6">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-border-dark pb-2">
          Cấu hình hiệu ứng & Âm lượng (Effects & Audio Settings)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Âm lượng (FR-4.1) */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Âm lượng (Volume)</h4>
            
            {/* Voice Volume */}
            {voiceAudio ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Âm lượng Voice chính</span>
                  <span className="text-primary-light font-mono font-semibold">
                    {voiceVolume > 0 ? `+${voiceVolume}` : voiceVolume} dB
                  </span>
                </div>
                <input 
                  type="range" 
                  min="-24" 
                  max="6" 
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseInt(e.target.value))}
                  className="w-full accent-primary h-1 bg-bg-dark rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ) : null}

            {/* SFX Volume */}
            {sfxPool.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Âm lượng SFX tổng thể</span>
                  <span className="text-primary-light font-mono font-semibold">
                    {sfxVolume > 0 ? `+${sfxVolume}` : sfxVolume} dB
                  </span>
                </div>
                <input 
                  type="range" 
                  min="-24" 
                  max="6" 
                  value={sfxVolume}
                  onChange={(e) => setSfxVolume(parseInt(e.target.value))}
                  className="w-full accent-primary h-1 bg-bg-dark rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ) : null}

            {!voiceAudio && sfxPool.length === 0 && (
              <p className="text-xs text-gray-500 italic">Chưa upload tệp thuyết minh hoặc SFX để điều chỉnh âm lượng.</p>
            )}
          </div>

          {/* Column 2: Chuyển cảnh (FR-4.2) */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l md:border-r border-border-dark md:px-6">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chuyển cảnh (Transition)</h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={transitionEnabled} 
                  onChange={(e) => setTransitionEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-bg-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
              </label>
            </div>

            {transitionEnabled ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500">Loại chuyển cảnh</span>
                  <select
                    value={transitionType}
                    onChange={(e) => setTransitionType(e.target.value as any)}
                    className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    <option value="dissolve">Dissolve (Crossfade)</option>
                    <option value="fade_black">Fade to Black</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] text-gray-500">Thời lượng transition (T)</span>
                    <span className="text-primary-light font-mono font-semibold">{transitionDuration}s</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.2" 
                    max="1.5" 
                    step="0.1"
                    value={transitionDuration}
                    onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                    className="w-full accent-primary h-1 bg-bg-dark rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Mặc định sử dụng Hard cut (chuyển cảnh tức thì).</p>
            )}
          </div>

          {/* Column 3: Ken Burns (FR-4.3) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ken Burns (Zoom/Pan)</h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={kenBurnsEnabled} 
                  onChange={(e) => setKenBurnsEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-bg-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
              </label>
            </div>

            {kenBurnsEnabled ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-300">
                  Áp dụng zoom/pan nhẹ ngẫu nhiên cố định cho từng ảnh storyboard (FR-3.2).
                </p>
                <button
                  onClick={reShuffleKenBurns}
                  className="w-full py-2 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Random lại Ken Burns
                </button>
                <span className="text-[10px] text-gray-500 block text-center">
                  (FR-3.6: Có thể vỡ nét ảnh độ phân giải thấp)
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Ảnh đứng yên hoàn toàn trong suốt thời gian hiển thị.</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Selection Detail & Large Preview */}
      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
          {/* Big Preview */}
          <div className="lg:col-span-3 bg-bg-panel border border-border-dark rounded-2xl overflow-hidden flex items-center justify-center relative min-h-[300px] shadow-inner">
            <img 
              src={`media://${encodeURIComponent(selectedFile.path)}`} 
              alt={selectedFile.name}
              className="max-w-full max-h-[400px] object-contain"
            />
            
            {selectedFile.isAutoFixed && (
              <div className="absolute top-4 left-4 bg-yellow-600/90 backdrop-blur border border-yellow-500/20 text-yellow-100 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-300" />
                <span>Auto-fixed: Trùng thời điểm bắt đầu (Gán hiển thị 0.5s)</span>
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="lg:col-span-2 flex flex-col justify-between bg-bg-panel border border-border-dark rounded-2xl p-6 shadow-lg">
            <div className="space-y-6">
              <h3 className="text-md font-bold text-white border-b border-border-dark pb-2">Chi tiết tệp đang chọn</h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Tên file ảnh</span>
                  <span className="font-mono text-white break-all">{selectedFile.name}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500 block">Thời điểm bắt đầu</span>
                    <span className="font-mono text-white font-semibold">
                      {formatTime(selectedFile.startTime)}
                    </span>
                    <span className="text-[10px] text-gray-500 block font-mono">({selectedFile.startTime} giây)</span>
                  </div>
                  
                  <div>
                    <span className="text-xs text-gray-500 block">Thời lượng hiển thị</span>
                    <span className="font-mono text-accent font-semibold">
                      {selectedFile.duration.toFixed(2)} giây
                    </span>
                  </div>
                </div>

                {/* Ken Burns detail status */}
                {kenBurnsEnabled && selectedFile.kbZoomDirection && (
                  <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-xl">
                    <span className="text-xs text-primary-light font-semibold flex items-center gap-1.5 mb-1">
                      <ZoomIn className="w-4 h-4" />
                      Ken Burns chuyển động
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs text-white font-mono mt-1">
                      <div>Hướng: <span className="text-accent">{selectedFile.kbZoomDirection === 'in' ? 'Zoom In' : 'Zoom Out'}</span></div>
                      <div>Tỉ lệ: <span className="text-accent">x{(selectedFile.kbZoomLimit || 1.1).toFixed(2)}</span></div>
                      <div className="col-span-2">Điểm neo Pan: <span className="text-accent">{selectedFile.kbPanAnchor}</span></div>
                    </div>
                  </div>
                )}

                {/* Assigned SFX info */}
                {selectedFile.sfxName && (
                  <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-xl">
                    <span className="text-xs text-primary-light font-semibold flex items-center gap-1.5 mb-1">
                      <Volume2 className="w-4 h-4" />
                      Hiệu ứng âm thanh gán kèm
                    </span>
                    <span className="text-xs font-mono text-white block truncate" title={selectedFile.sfxName}>
                      {selectedFile.sfxName}
                    </span>
                    <span className="text-[9px] text-gray-500 block break-all font-mono mt-1 select-all bg-bg-dark/40 px-2 py-1 rounded">
                      {selectedFile.sfxPath}
                    </span>
                  </div>
                )}

                {/* Cascade Shift Controls FR-2 */}
                {(() => {
                  const selectedIndex = files.findIndex(f => f.path === selectedFile.path);
                  return (
                    <div className="bg-bg-dark border border-border-dark/60 p-4 rounded-xl space-y-3">
                      <span className="text-xs text-gray-400 font-semibold block">
                        Tịnh tiến thời lượng Cascade (đến hết timeline)
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selectedIndex !== -1) {
                              cascadeShift(selectedIndex, 'forward');
                            }
                          }}
                          className="flex-1 py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          title="Lấy thời lượng hình trước gán cho hình sau liên tục"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Tiến lên (Forward)
                        </button>
                        
                        <button
                          onClick={() => {
                            if (selectedIndex !== -1) {
                              cascadeShift(selectedIndex, 'backward');
                            }
                          }}
                          className="flex-1 py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          title="Lấy thời lượng hình sau gán cho hình trước liên tục"
                        >
                          Lùi lại (Backward)
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[9px] text-gray-500 block leading-relaxed">
                        * Tiến lên: gán thời lượng hình trước cho hình sau (tịnh tiến phải).<br/>
                        * Lùi lại: gán thời lượng hình sau cho hình trước (tịnh tiến trái).
                      </span>
                    </div>
                  );
                })()}

                <div>
                  <span className="text-xs text-gray-500 block">Đường dẫn đầy đủ</span>
                  <span className="font-mono text-xs text-gray-400 break-all select-all block bg-bg-dark border border-border-dark/60 p-2 rounded-lg mt-1">
                    {selectedFile.path}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-4 border-t border-border-dark pt-6 mt-6">
              <button 
                onClick={() => setStep('import')}
                className="flex-1 py-3 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>
              
              <button 
                disabled={!validation.isValid}
                onClick={() => setStep('settings')}
                className={`flex-1 py-3 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${validation.isValid ? 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 cursor-pointer group' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
              >
                Cấu hình xuất
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
