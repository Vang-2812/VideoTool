import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Folder, 
  ArrowLeft,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

interface QueueItem {
  id: string;
  name: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  progress: number;
  eta: string;
  error?: string;
  videoPath?: string;
}

export default function BatchProgressScreen() {
  const { projectsList, setStep } = useProject();
  
  // Load configuration passed from Dashboard
  const batchConfig = useMemo(() => {
    return (window as any).activeBatchConfig || { projectIds: [], outputDir: '' };
  }, []);

  const { projectIds, outputDir } = batchConfig;

  // Initialize queue state
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    return projectIds.map((id: string) => {
      const meta = projectsList.find(p => p.project_id === id);
      return {
        id,
        name: meta ? meta.project_name : 'Dự án không xác định',
        status: 'queued',
        progress: 0,
        eta: '--:--'
      };
    });
  });

  const [batchStatus, setBatchStatus] = useState<'running' | 'completed' | 'cancelled'>('running');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Stats calculation
  const stats = useMemo(() => {
    const total = queue.length;
    const completed = queue.filter(item => item.status === 'completed').length;
    const failed = queue.filter(item => item.status === 'failed').length;
    const pending = queue.filter(item => item.status === 'queued').length;
    
    // Overall progress formula: completed fraction + active project's progress weight
    const activeItem = queue.find(item => item.status === 'rendering');
    const activeProgress = activeItem ? activeItem.progress : 0;
    const overallProgress = total > 0 
      ? Math.round(((completed + (activeProgress / 100)) / total) * 100) 
      : 0;

    return { total, completed, failed, pending, overallProgress };
  }, [queue]);

  useEffect(() => {
    if (projectIds.length === 0 || !outputDir) {
      setBatchStatus('completed');
      return;
    }

    let unsubStart: (() => void) | null = null;
    let unsubProgress: (() => void) | null = null;
    let unsubComplete: (() => void) | null = null;

    // 1. Subscribe to batch events
    unsubStart = window.electronAPI.onBatchProjectStart(({ projectId }) => {
      setActiveProjectId(projectId);
      setQueue(prev => prev.map(item => 
        item.id === projectId 
          ? { ...item, status: 'rendering', progress: 0, eta: 'Đang chuẩn bị...' } 
          : item
      ));
    });

    unsubProgress = window.electronAPI.onBatchProjectProgress(({ projectId, progress, eta }) => {
      setQueue(prev => prev.map(item => 
        item.id === projectId 
          ? { ...item, progress, eta } 
          : item
      ));
    });

    unsubComplete = window.electronAPI.onBatchProjectComplete(({ projectId, success, videoPath, error }) => {
      setQueue(prev => prev.map(item => 
        item.id === projectId 
          ? { 
              ...item, 
              status: success ? 'completed' : 'failed', 
              progress: success ? 100 : item.progress,
              eta: '--:--', 
              videoPath, 
              error 
            } 
          : item
      ));
    });

    // 2. Start batch rendering process
    window.electronAPI.startBatchRender(projectIds, outputDir)
      .then((res) => {
        setBatchStatus(res.success ? 'completed' : 'cancelled');
        setActiveProjectId(null);
      })
      .catch((err) => {
        console.error('Batch render error:', err);
        setBatchStatus('completed');
        setActiveProjectId(null);
      });

    // Clean up listeners on unmount
    return () => {
      if (unsubStart) unsubStart();
      if (unsubProgress) unsubProgress();
      if (unsubComplete) unsubComplete();
    };
  }, [projectIds, outputDir]);

  const handleCancelBatch = async () => {
    const confirmCancel = window.confirm("Anh có chắc chắn muốn hủy xuất video hàng loạt không? Các tiến trình đang chạy dở sẽ bị dừng ngay lập tức.");
    if (confirmCancel) {
      await window.electronAPI.cancelBatchExport();
      setBatchStatus('cancelled');
    }
  };

  const handleOpenFolder = (videoPath?: string) => {
    if (videoPath) {
      window.electronAPI.openDirectory(videoPath);
    }
  };

  const handleBackToDashboard = () => {
    // Clear temp batch configs
    delete (window as any).activeBatchConfig;
    setStep('dashboard');
  };

  return (
    <div className="flex flex-col gap-6 py-4 h-full max-w-4xl mx-auto space-y-4">
      {/* Title Header */}
      <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-accent" />
            Tiến trình xuất hàng loạt (Batch Exporting)
          </h2>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            <span>Thư mục đầu ra:</span>
            <span className="font-mono bg-bg-dark border border-border-dark px-2 py-0.5 rounded text-[10px] truncate max-w-[400px]" title={outputDir}>
              {outputDir}
            </span>
          </div>
        </div>

        {batchStatus === 'running' ? (
          <button
            onClick={handleCancelBatch}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-red-900/20 cursor-pointer transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Hủy xuất hàng loạt
          </button>
        ) : (
          <button
            onClick={handleBackToDashboard}
            className="px-4 py-2 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay về thư viện
          </button>
        )}
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Overall progress bar */}
        <div className="bg-bg-panel border border-border-dark p-4 rounded-xl shadow sm:col-span-2 flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-semibold">Tiến trình tổng quan</span>
            <span className="text-accent font-bold text-sm font-mono">{stats.overallProgress}%</span>
          </div>
          <div className="w-full bg-bg-dark rounded-full h-2.5 overflow-hidden border border-border-dark">
            <div 
              style={{ width: `${stats.overallProgress}%` }}
              className="bg-accent h-full rounded-full transition-all duration-300"
            ></div>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">
            {stats.completed}/{stats.total} dự án hoàn tất ({stats.failed} lỗi)
          </span>
        </div>

        {/* Success count */}
        <div className="bg-bg-panel border border-border-dark p-4 rounded-xl shadow flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 block font-semibold">Thành công</span>
            <span className="text-xl font-bold text-green-400 font-mono">{stats.completed}</span>
          </div>
          <div className="bg-green-500/10 p-2.5 rounded-lg border border-green-500/15 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Failed count */}
        <div className="bg-bg-panel border border-border-dark p-4 rounded-xl shadow flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 block font-semibold">Bị lỗi</span>
            <span className="text-xl font-bold text-red-400 font-mono">{stats.failed}</span>
          </div>
          <div className="bg-red-500/10 p-2.5 rounded-lg border border-red-500/15 text-red-400">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Queue items list */}
      <div className="bg-bg-panel border border-border-dark rounded-2xl overflow-hidden shadow-lg flex flex-col">
        <div className="px-6 py-4 border-b border-border-dark bg-bg-panel/40 flex justify-between items-center">
          <span className="text-xs font-bold text-white">Danh sách hàng đợi Render ({queue.length})</span>
          <span className="text-[10px] font-semibold uppercase text-accent font-mono">
            {batchStatus === 'running' ? 'Đang xuất video...' : batchStatus === 'cancelled' ? 'Đã hủy giữa chừng' : 'Đã hoàn tất'}
          </span>
        </div>

        <div className="divide-y divide-border-dark/65 max-h-[400px] overflow-y-auto custom-scrollbar">
          {queue.map((item, index) => {
            const isCurrentlyRendering = item.status === 'rendering';

            return (
              <div 
                key={item.id} 
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isCurrentlyRendering ? 'bg-primary/5' : 'bg-transparent'}`}
              >
                {/* Info */}
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <span className="text-xs font-mono text-gray-500 w-5 shrink-0">{(index + 1).toString().padStart(2, '0')}</span>
                  <div className="overflow-hidden min-w-[200px]">
                    <span className="text-xs font-bold text-white block truncate" title={item.name}>{item.name}</span>
                    
                    {/* Render details */}
                    {isCurrentlyRendering && (
                      <span className="text-[9px] text-gray-400 font-mono flex items-center gap-1.5 mt-1.5">
                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                        ETA: <strong className="text-white">{item.eta}</strong>
                      </span>
                    )}

                    {/* Error display */}
                    {item.status === 'failed' && item.error && (
                      <span className="text-[9px] text-red-400 flex items-center gap-1.5 mt-1.5 font-mono">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {item.error}
                      </span>
                    )}

                    {/* Success path display */}
                    {item.status === 'completed' && item.videoPath && (
                      <button 
                        onClick={() => handleOpenFolder(item.videoPath)}
                        className="text-[9px] text-accent hover:text-accent-hover font-mono flex items-center gap-1.5 mt-1.5 bg-accent/5 hover:bg-accent/15 border border-accent/15 px-2 py-0.5 rounded transition-all cursor-pointer text-left truncate w-full"
                        title="Click để hiển thị file video trong thư mục"
                      >
                        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-accent" />
                        {item.videoPath}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar inside row (only when rendering) */}
                {isCurrentlyRendering && (
                  <div className="w-full sm:w-44 flex flex-col gap-1.5">
                    <div className="w-full bg-bg-dark rounded-full h-1.5 overflow-hidden border border-border-dark">
                      <div 
                        style={{ width: `${item.progress}%` }}
                        className="bg-primary h-full rounded-full transition-all duration-200"
                      ></div>
                    </div>
                    <span className="text-[9px] text-right font-mono text-primary-light font-semibold">{item.progress}%</span>
                  </div>
                )}

                {/* Status Badges */}
                <div className="shrink-0 self-end sm:self-center">
                  {item.status === 'queued' && (
                    <span className="px-2.5 py-1 bg-bg-dark border border-border-dark text-gray-500 rounded-lg text-[10px] font-semibold">
                      Đang chờ
                    </span>
                  )}
                  {item.status === 'rendering' && (
                    <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary-light rounded-lg text-[10px] font-semibold flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 text-primary animate-spin" />
                      Rendering
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/15 text-green-400 rounded-lg text-[10px] font-semibold">
                      Hoàn thành
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/15 text-red-400 rounded-lg text-[10px] font-semibold">
                      Bị lỗi
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion report banner */}
      {batchStatus !== 'running' && (
        <div className={`p-5 rounded-2xl border flex items-start gap-3.5 animate-in fade-in slide-in-from-bottom-4 duration-300 ${batchStatus === 'cancelled' ? 'bg-yellow-950/20 border-yellow-500/10 text-yellow-300' : 'bg-green-950/10 border-green-500/10 text-green-300'}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${batchStatus === 'cancelled' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500' : 'bg-green-500/10 border border-green-500/20 text-green-500'}`}>
            {batchStatus === 'cancelled' ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white">
              {batchStatus === 'cancelled' ? 'Tiến trình đã bị dừng bởi người dùng' : 'Hoàn tất quá trình render hàng loạt'}
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {batchStatus === 'cancelled' 
                ? 'Đã dừng hàng đợi render. Các video hoàn tất trước thời điểm hủy được giữ nguyên trong thư mục đích.'
                : `Đã kết xuất thành công ${stats.completed}/${stats.total} dự án storyboard doodle thành file video MP4. Vui lòng bấm vào tên đường dẫn để mở thư mục chứa video.`}
            </p>
            <div className="pt-2">
              <button
                onClick={handleBackToDashboard}
                className="px-3.5 py-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
              >
                Quay về Thư viện
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
