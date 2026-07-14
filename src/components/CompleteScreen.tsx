import React from 'react';
import { useProject } from '../context/ProjectContext';
import { CheckCircle2, Play, FolderOpen, RefreshCcw, FileVideo } from 'lucide-react';

export default function CompleteScreen() {
  const { renderResult, resetProject } = useProject();

  const handlePlayVideo = async () => {
    const playPath = renderResult?.videoPath || renderResult?.verticalVideoPaths?.[0];
    if (playPath) {
      await window.electronAPI.playVideo(playPath);
    }
  };

  const handleOpenFolder = async () => {
    const folderPath = renderResult?.videoPath || renderResult?.verticalVideoPaths?.[0];
    if (folderPath) {
      await window.electronAPI.openDirectory(folderPath);
    }
  };

  // Helper to format bytes to human-readable size
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper to format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] py-8">
      <div className="glass-panel p-8 rounded-2xl max-w-xl w-full shadow-2xl border border-border-dark text-center space-y-6">
        
        {/* Success Icon */}
        <div className="w-16 h-16 bg-accent/15 border border-accent/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-accent/5">
          <CheckCircle2 className="w-8 h-8 text-accent animate-pulse" />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-white">Xuất Video Hoàn Tất!</h2>
          <p className="text-sm text-gray-400">Video storyboard của bạn đã được đóng gói thành công ở local.</p>
        </div>

        {/* Video metadata card */}
        {renderResult && (
          <div className="bg-bg-dark border border-border-dark p-6 rounded-xl text-left space-y-4 shadow-inner">
            <div className="flex items-center gap-3 border-b border-border-dark/60 pb-3">
              <FileVideo className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Thông số video đầu ra</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Thời lượng video</span>
                <span className="text-white font-mono font-semibold text-sm">
                  {formatTime(renderResult.duration || 0)}
                </span>
                <span className="text-[10px] text-gray-500 block font-mono">({renderResult.duration} giây)</span>
              </div>
              
              <div>
                <span className="text-gray-500 block">Dung lượng tệp</span>
                <span className="text-white font-mono font-semibold text-sm">
                  {formatBytes(renderResult.sizeBytes || 0)}
                </span>
              </div>
            </div>

            {renderResult.videoPath && (
              <div className="pt-2 border-t border-border-dark/30">
                <span className="text-gray-500 block text-xs">Đường dẫn tệp kết quả</span>
                <code className="text-[11px] text-accent font-mono block break-all bg-bg-card p-2.5 rounded-lg border border-border-dark mt-1 select-all">
                  {renderResult.videoPath}
                </code>
              </div>
            )}

            {renderResult.verticalVideoPaths && renderResult.verticalVideoPaths.length > 0 && (
              <div className="pt-2 border-t border-border-dark/30">
                <span className="text-gray-500 block text-xs">Video dọc đã tạo ({renderResult.verticalVideoPaths.length} file)</span>
                <div className="mt-1.5 space-y-1">
                  {renderResult.verticalVideoPaths.map((filePath) => (
                    <code key={filePath} className="text-[11px] text-accent font-mono block break-all bg-bg-card p-2 rounded-lg border border-border-dark select-all">
                      {filePath}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handlePlayVideo}
            className="py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-primary/10"
          >
            <Play className="w-4 h-4 fill-white" />
            Phát thử video
          </button>
          
          <button
            onClick={handleOpenFolder}
            className="py-3 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-200 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Mở thư mục chứa file
          </button>
        </div>

        {/* Reset button */}
        <div className="border-t border-border-dark pt-6 mt-4">
          <button
            onClick={resetProject}
            className="py-3 px-6 hover:bg-bg-panel border border-border-dark text-gray-400 hover:text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 mx-auto cursor-pointer transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Tạo dự án mới
          </button>
        </div>

      </div>
    </div>
  );
}
