import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Loader2, AlertCircle, XCircle } from 'lucide-react';

export default function RenderScreen() {
  const { renderProgress, cancelRender, setStep } = useProject();

  const handleCancel = async () => {
    if (confirm("Bạn có chắc chắn muốn hủy quá trình render video đang chạy?")) {
      await cancelRender();
    }
  };

  const progressPercent = Math.min(100, Math.max(0, Math.round(renderProgress.progress)));

  return (
    <div className="flex flex-col items-center justify-center min-h-[450px] py-8">
      <div className="glass-panel p-8 rounded-2xl max-w-lg w-full shadow-2xl border border-border-dark text-center">
        
        {renderProgress.error ? (
          // Error State
          <div className="space-y-6">
            <div className="w-16 h-16 bg-red-950/50 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Xuất Video Thất Bại</h2>
              <p className="text-sm text-gray-400">Đã xảy ra lỗi trong quá trình xử lý encode video bằng FFmpeg.</p>
            </div>

            <div className="bg-bg-dark border border-border-dark p-4 rounded-xl text-left max-h-40 overflow-y-auto">
              <span className="text-[10px] text-gray-500 block mb-1 uppercase font-semibold">Chi tiết mã lỗi:</span>
              <code className="text-xs text-red-400 font-mono break-all whitespace-pre-wrap">
                {renderProgress.error}
              </code>
            </div>

            <button
              onClick={() => setStep('settings')}
              className="w-full py-3 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-200 font-semibold rounded-xl cursor-pointer transition-colors"
            >
              Quay lại cấu hình xuất
            </button>
          </div>
        ) : (
          // Rendering State
          <div className="space-y-8">
            <div className="relative w-20 h-20 mx-auto">
              {/* Spinner animation */}
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Đang render video...</h2>
              <p className="text-xs text-gray-400">Vui lòng không đóng ứng dụng hoặc thay đổi các tệp ảnh nguồn.</p>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-gray-400 font-mono px-1">
                <span>Tiến trình: {progressPercent}%</span>
                <span>ETA: {renderProgress.eta}</span>
              </div>
              
              <div className="w-full h-3.5 bg-bg-dark border border-border-dark rounded-full overflow-hidden p-0.5">
                <div 
                  style={{ width: `${progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300 shadow-md shadow-primary/20"
                ></div>
              </div>

              {renderProgress.currentFrame !== undefined && renderProgress.totalFrames !== undefined && (
                <div className="text-[10px] text-gray-500 font-mono text-left px-1">
                  Đang encode frame: {renderProgress.currentFrame} / {renderProgress.totalFrames}
                </div>
              )}
              {renderProgress.segmentIndex && renderProgress.segmentCount && (
                <div className="text-[10px] text-primary font-mono text-left px-1">
                  Đang tạo video dọc {renderProgress.segmentIndex}/{renderProgress.segmentCount}
                </div>
              )}
            </div>

            {/* Cancel Action */}
            <button 
              onClick={handleCancel}
              className="py-2.5 px-6 border border-red-500/30 hover:border-red-500/50 bg-red-950/10 hover:bg-red-950/20 text-red-400 hover:text-red-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 mx-auto cursor-pointer transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Hủy quá trình render
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
