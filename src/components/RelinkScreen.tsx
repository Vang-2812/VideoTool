import React from 'react';
import { useProject } from '../context/ProjectContext';
import { AlertTriangle, FileImage, Music, Link, Trash2, XCircle } from 'lucide-react';

export default function RelinkScreen() {
  const { 
    missingFiles, 
    tempProjectData, 
    relinkFile, 
    ignoreMissingFiles, 
    cancelRelinking 
  } = useProject();

  if (!tempProjectData || missingFiles.length === 0) return null;

  const handleRelink = async (oldPath: string) => {
    // Determine expected file type based on extension
    const ext = oldPath.split('.').pop()?.toLowerCase() || '';
    const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
    const extensions = isImage ? ['png', 'jpg', 'jpeg'] : ['mp3', 'wav'];

    try {
      const selected = await window.electronAPI.selectRelinkFile(extensions);
      if (selected) {
        await relinkFile(oldPath, selected.path);
      }
    } catch (err) {
      console.error('Relink file error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-dark/95 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-bg-panel border border-border-dark rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Title */}
        <div className="flex items-start gap-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl shrink-0">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Phát hiện tệp tài nguyên bị thiếu (Assets Missing)</h2>
            <p className="text-xs text-gray-400 mt-1">
              Ứng dụng phát hiện một số tệp hình ảnh/âm thanh đã bị xóa, di chuyển hoặc đổi tên kể từ lần cuối dự án này được lưu.
            </p>
          </div>
        </div>

        {/* Missing Files List */}
        <div className="space-y-3 bg-bg-dark/50 border border-border-dark p-4 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar">
          {missingFiles.map((p, idx) => {
            const ext = p.split('.').pop()?.toLowerCase() || '';
            const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
            const filename = p.split(/[\\/]/).pop() || p;

            return (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-card p-3 rounded-lg border border-border-dark/60 hover:border-gray-500/50 transition-colors">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-2 bg-bg-panel border border-border-dark rounded-lg shrink-0">
                    {isImage ? (
                      <FileImage className="w-4 h-4 text-primary-light" />
                    ) : (
                      <Music className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-xs font-semibold text-white truncate block">{filename}</span>
                    <span className="text-[10px] text-gray-500 font-mono truncate block" title={p}>{p}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRelink(p)}
                  className="shrink-0 self-end sm:self-center bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 px-3 py-1.5 rounded-lg text-primary-light text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5" />
                  Tìm tệp...
                </button>
              </div>
            );
          })}
        </div>

        {/* Warning Note */}
        <div className="bg-yellow-950/20 border border-yellow-500/10 text-yellow-300 text-xs p-4 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-yellow-500 mt-0.5" />
          <span>
            <strong>Chú ý:</strong> Nếu anh chọn <strong>"Bỏ qua"</strong>, các slide ảnh bị thiếu sẽ bị loại bỏ hoàn toàn khỏi timeline hiển thị. Ứng dụng sẽ tự động sắp xếp và tính toán lại thời lượng hiển thị cho các slide còn lại (FR-1.6.b).
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={cancelRelinking}
            className="flex-1 py-3 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Hủy mở dự án
          </button>

          <button
            onClick={ignoreMissingFiles}
            className="flex-1 py-3 bg-yellow-600/10 hover:bg-yellow-600/25 border border-yellow-600/35 hover:border-yellow-500 text-yellow-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Bỏ qua các tệp thiếu
          </button>
        </div>

      </div>
    </div>
  );
}
