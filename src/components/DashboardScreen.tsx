import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Plus, 
  Search, 
  Copy, 
  Edit2, 
  Trash2, 
  FolderOpen, 
  Clock, 
  Images, 
  CheckSquare, 
  Square, 
  Download, 
  AlertTriangle, 
  X,
  FileVideo,
  Smartphone
} from 'lucide-react';

interface DashboardScreenProps {
  onNavigateToVertical: () => void;
}

export default function DashboardScreen({ onNavigateToVertical }: DashboardScreenProps) {
  const { 
    projectsList, 
    refreshProjectsList, 
    loadProject, 
    duplicateProject, 
    deleteProject, 
    createNewProject, 
    saveProject,
    setStep
  } = useProject();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals state
  const [renameProject, setRenameProject] = useState<any | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renameError, setRenameError] = useState('');
  
  const [deleteProj, setDeleteProj] = useState<any | null>(null);

  // Refresh project list on mount
  useEffect(() => {
    refreshProjectsList();
  }, []);

  // Helper to format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to format modification timestamp
  const formatLastModified = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Filter projects by search query
  const filteredProjects = projectsList.filter(p => 
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenProject = async (id: string) => {
    const res = await loadProject(id);
    if (!res.success) {
      alert(res.error || 'Lỗi khi mở project.');
    }
  };

  const handleDuplicate = async (id: string) => {
    const res = await duplicateProject(id);
    if (!res.success) {
      alert(res.error || 'Lỗi khi nhân bản project.');
    }
  };

  const openRenameModal = (project: any) => {
    setRenameProject(project);
    setRenameInput(project.project_name);
    setRenameError('');
  };

  const handleRename = async () => {
    if (!renameInput.trim()) {
      setRenameError('Tên dự án không được bỏ trống.');
      return;
    }

    // V-1: Check duplicate name (except current project)
    const nameCollision = projectsList.some(p => 
      p.project_name.toLowerCase() === renameInput.trim().toLowerCase() && 
      p.project_id !== renameProject.project_id
    );

    if (nameCollision) {
      setRenameError('Tên dự án này đã tồn tại. Vui lòng nhập tên khác.');
      return;
    }

    try {
      // Load the project full data, change its name, and save
      const loadRes = await window.electronAPI.loadProject(renameProject.project_id);
      if (loadRes.success && loadRes.project) {
        const updated = {
          ...loadRes.project,
          project_name: renameInput.trim()
        };
        const saveRes = await window.electronAPI.saveProject(updated);
        if (saveRes.success) {
          refreshProjectsList();
          setRenameProject(null);
        } else {
          setRenameError(saveRes.error || 'Lỗi khi lưu tên mới.');
        }
      } else {
        setRenameError(loadRes.error || 'Lỗi khi nạp dữ liệu dự án để đổi tên.');
      }
    } catch (err: any) {
      setRenameError(err.message || 'Lỗi hệ thống khi đổi tên.');
    }
  };

  const openDeleteModal = (project: any) => {
    setDeleteProj(project);
  };

  const handleDelete = async () => {
    if (!deleteProj) return;
    const res = await deleteProject(deleteProj.project_id);
    if (res.success) {
      setDeleteProj(null);
    } else {
      alert(res.error || 'Lỗi khi xóa project.');
    }
  };

  const toggleSelectProject = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBatchExport = async () => {
    if (selectedIds.length === 0) return;
    
    // 1. Let the user choose the common output folder
    const destDir = await window.electronAPI.selectExportDirectory();
    if (!destDir) return; // cancelled

    // 2. Set the batch parameters on custom window property or pass through step navigation?
    // We can store the selected project IDs and destination folder on window or in storage,
    // or let's extend the context or pass it!
    // Wait, let's extend the window context to hold this temporary batch configuration!
    (window as any).activeBatchConfig = {
      projectIds: selectedIds,
      outputDir: destDir
    };

    // 3. Move to batch progress screen
    setStep('batch_progress');
  };

  return (
    <div className="flex flex-col gap-6 py-4 h-full">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-bg-panel p-6 rounded-2xl border border-border-dark shadow-lg">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-dark border border-border-dark hover:border-gray-500 focus:border-primary text-white pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-3.5 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {projectsList.length > 0 && (
            <button
              onClick={() => {
                setSelectMode(!selectMode);
                setSelectedIds([]);
              }}
              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${selectMode ? 'bg-primary/20 border-primary text-primary-light hover:bg-primary/30' : 'bg-bg-card hover:bg-bg-dark border-border-dark text-gray-300'}`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectMode ? 'Thoát chọn' : 'Chọn nhiều xuất video'}
            </button>
          )}

          {selectMode && selectedIds.length > 0 && (
            <button
              onClick={handleBatchExport}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-accent/20 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất hàng loạt ({selectedIds.length})
            </button>
          )}

          <button
            onClick={onNavigateToVertical}
            className="px-4 py-2.5 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-primary" />
            Chuyển đổi dọc 9:16
          </button>

          <button
            onClick={createNewProject}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-primary/20 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo dự án mới
          </button>
        </div>
      </div>

      {/* Grid List of Projects */}
      {filteredProjects.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-border-dark bg-bg-panel/40 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <FileVideo className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-white font-semibold text-sm mb-1">
            {searchTerm ? 'Không tìm thấy dự án nào khớp' : 'Thư viện dự án trống (V-6)'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mb-6 leading-relaxed">
            {searchTerm 
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bấm dấu hủy tìm kiếm để hiển thị lại toàn bộ.' 
              : 'Ứng dụng chưa lưu dự án nào. Bấm nút phía dưới để tạo dự án storyboard doodle mới.'}
          </p>
          {!searchTerm && (
            <button
              onClick={createNewProject}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-primary/20 cursor-pointer transition-colors"
            >
              <Plus className="w-4.5 h-4.5" />
              Tạo dự án đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProjects.map((p) => {
            const isSelected = selectedIds.includes(p.project_id);
            const thumbUrl = p.thumbnail_path 
              ? `media://${encodeURIComponent(p.thumbnail_path)}` 
              : null;

            return (
              <div 
                key={p.project_id}
                className={`bg-bg-panel border rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between group transition-all duration-200 ${selectMode ? (isSelected ? 'border-accent shadow-accent/5 ring-2 ring-accent/20' : 'border-border-dark hover:border-gray-500') : 'border-border-dark hover:border-primary/50 hover:shadow-primary/5'}`}
              >
                {/* Thumbnail Card Area */}
                <div 
                  onClick={() => selectMode ? toggleSelectProject(p.project_id) : handleOpenProject(p.project_id)}
                  className="w-full h-36 bg-bg-dark overflow-hidden relative cursor-pointer border-b border-border-dark/60"
                >
                  {thumbUrl ? (
                    <img 
                      src={thumbUrl} 
                      alt={p.project_name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-bg-card">
                      <FileVideo className="w-10 h-10 text-gray-600 mb-1" />
                      <span className="text-[10px] uppercase font-semibold">Chưa có ảnh</span>
                    </div>
                  )}

                  {/* Play Overlay (Only when not in selectMode) */}
                  {!selectMode && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {/* Checkbox (Select Mode) */}
                  {selectMode && (
                    <div className="absolute top-3 left-3 z-10">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-lg bg-accent text-white flex items-center justify-center border border-accent">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-black/60 border border-white/30 text-white hover:border-white flex items-center justify-center backdrop-blur">
                          <Square className="w-4 h-4 text-transparent" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Slide count tag */}
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-[9px] font-mono text-gray-300 px-2 py-0.5 rounded flex items-center gap-1">
                    <Images className="w-3 h-3" />
                    <span>{p.filesCount} ảnh</span>
                  </div>
                </div>

                {/* Content & Metadata */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <h3 
                      onClick={() => !selectMode && handleOpenProject(p.project_id)}
                      className={`font-semibold text-xs text-white truncate ${!selectMode && 'cursor-pointer hover:text-primary-light transition-colors'}`}
                      title={p.project_name}
                    >
                      {p.project_name}
                    </h3>
                    <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(p.totalDuration)}
                      </span>
                      <span>{formatLastModified(p.updated_at)}</span>
                    </div>
                  </div>

                  {/* Actions (Hidden in Select Mode) */}
                  {!selectMode && (
                    <div className="flex items-center gap-2 border-t border-border-dark/45 pt-3">
                      <button
                        onClick={() => handleOpenProject(p.project_id)}
                        className="flex-1 py-1.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 text-primary-light text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Mở dự án"
                      >
                        <FolderOpen className="w-3 h-3" />
                        Mở
                      </button>
                      <button
                        onClick={() => handleDuplicate(p.project_id)}
                        className="p-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Nhân bản (Duplicate)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openRenameModal(p)}
                        className="p-1.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Đổi tên"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(p)}
                        className="p-1.5 bg-bg-card hover:bg-red-950/20 border border-border-dark hover:border-red-900 text-gray-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Xóa dự án"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename Modal */}
      {renameProject && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Đổi tên dự án
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500">Tên dự án mới</label>
              <input 
                type="text" 
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-3 py-2 rounded-xl text-xs outline-none font-sans"
              />
              {renameError && (
                <span className="text-[10px] text-red-400 block">{renameError}</span>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setRenameProject(null)}
                className="flex-1 py-2 border border-border-dark text-gray-300 rounded-xl text-xs font-semibold hover:bg-bg-dark cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleRename}
                className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover cursor-pointer"
              >
                Đổi tên
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (V-3) */}
      {deleteProj && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Xác nhận xóa dự án</h3>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  Xóa dự án <strong>"{deleteProj.project_name}"</strong> sẽ không xóa ảnh/âm thanh gốc trên máy, chỉ xóa file cấu hình project này khỏi thư mục của ứng dụng (FR-2.7).
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteProj(null)}
                className="flex-1 py-2 border border-border-dark text-gray-300 rounded-xl text-xs font-semibold hover:bg-bg-dark cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
