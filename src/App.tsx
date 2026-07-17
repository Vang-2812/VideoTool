import React, { useState, useEffect } from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import type { Step } from './context/ProjectContext';
import DashboardScreen from './components/DashboardScreen';
import ImportScreen from './components/ImportScreen';
import PreviewScreen from './components/PreviewScreen';
import SettingsScreen from './components/SettingsScreen';
import RenderScreen from './components/RenderScreen';
import CompleteScreen from './components/CompleteScreen';
import BatchProgressScreen from './components/BatchProgressScreen';
import RelinkScreen from './components/RelinkScreen';
import TtsScreen from './components/TtsScreen';
import AppSettingsScreen from './components/AppSettingsScreen';
import AlignerScreen from './components/AlignerScreen';
import VerticalConvertScreen from './components/VerticalConvertScreen';
import ReupScreen from './components/ReupScreen';
import Sidebar from './components/Sidebar';
import logoUrl from './logo.svg';
import { 
  Film, 
  Save, 
  Copy, 
  Library, 
  AlertCircle, 
  Check,
  ChevronRight,
  Volume2,
  Settings,
  Mic,
  Smartphone,
  Video
} from 'lucide-react';

const STEPS: { id: Step; label: string }[] = [
  { id: 'import', label: 'Import Ảnh' },
  { id: 'preview', label: 'Timeline Preview' },
  { id: 'settings', label: 'Cấu Hình Xuất' },
  { id: 'rendering', label: 'Rendering' },
  { id: 'complete', label: 'Hoàn Tất' }
];

function MainLayout() {
  const { 
    step, 
    missingFiles, 
    tempProjectData,
    projectId,
    projectName,
    isUnsaved,
    saveProject,
    saveProjectAs,
    resetProject,
    setStep 
  } = useProject();

  const [activeModule, setActiveModule] = useState<'storyboard' | 'tts' | 'aligner' | 'settings' | 'vertical' | 'reup'>('storyboard');
  const [sharedTtsOutput, setSharedTtsOutput] = useState<{ audioPath: string; scriptText: string } | null>(null);

  useEffect(() => {
    if (step !== 'dashboard') {
      setActiveModule('storyboard');
    }
  }, [step]);

  const isRelinking = missingFiles.length > 0 && tempProjectData !== null;

  const getStepIndex = (s: Step) => {
    return STEPS.findIndex(x => x.id === s);
  };

  const currentIdx = getStepIndex(step);
  const isProjectActive = currentIdx >= 0 && step !== 'rendering';

  // Save Modal States
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState('');

  // Save As Modal States
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [saveAsError, setSaveAsError] = useState('');

  // Exit Confirmation Modal
  const [exitOpen, setExitOpen] = useState(false);

  // Toast notification
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  const handleSaveClick = async () => {
    if (projectName) {
      const res = await saveProject();
      if (res.success) {
        setShowToast(true);
      } else {
        alert(res.error || 'Lỗi khi lưu.');
      }
    } else {
      setSaveName('');
      setSaveError('');
      setSaveOpen(true);
    }
  };

  const handleSaveSubmit = async () => {
    if (!saveName.trim()) {
      setSaveError('Tên dự án không được bỏ trống.');
      return;
    }
    const res = await saveProject(saveName.trim());
    if (res.success) {
      setSaveOpen(false);
      setShowToast(true);
    } else {
      setSaveError(res.error || 'Lỗi khi lưu.');
    }
  };

  const handleSaveAsClick = () => {
    setSaveAsName(projectName ? `${projectName} (Copy)` : 'Project Mới');
    setSaveAsError('');
    setSaveAsOpen(true);
  };

  const handleSaveAsSubmit = async () => {
    if (!saveAsName.trim()) {
      setSaveAsError('Tên dự án không được bỏ trống.');
      return;
    }
    const res = await saveProjectAs(saveAsName.trim());
    if (res.success) {
      setSaveAsOpen(false);
      setShowToast(true);
    } else {
      setSaveAsError(res.error || 'Lỗi khi lưu.');
    }
  };

  const handleExitClick = () => {
    if (isUnsaved) {
      setExitOpen(true);
    } else {
      resetProject();
      setStep('dashboard');
    }
  };

  const handleExitDiscard = () => {
    setExitOpen(false);
    resetProject();
    setStep('dashboard');
  };

  const handleExitSave = async () => {
    if (projectName) {
      const res = await saveProject();
      if (res.success) {
        setExitOpen(false);
        resetProject();
        setStep('dashboard');
      } else {
        alert(res.error || 'Lỗi khi lưu.');
      }
    } else {
      setExitOpen(false);
      setSaveName('');
      setSaveError('');
      setSaveOpen(true);
    }
  };

  const renderActiveScreen = () => {
    if (activeModule === 'tts') {
      return (
        <TtsScreen 
          onNavigateToAligner={(audioPath, scriptText) => {
            setSharedTtsOutput({ audioPath, scriptText });
            setActiveModule('aligner');
          }}
        />
      );
    }
    if (activeModule === 'aligner') {
      return (
        <AlignerScreen 
          sharedTtsOutput={sharedTtsOutput}
          clearSharedTts={() => setSharedTtsOutput(null)}
        />
      );
    }
    if (activeModule === 'vertical') {
      return <VerticalConvertScreen />;
    }
    if (activeModule === 'reup') {
      return <ReupScreen />;
    }
    if (activeModule === 'settings') {
      return <AppSettingsScreen />;
    }

    switch (step) {
      case 'dashboard':
        return <DashboardScreen onNavigateToVertical={() => setActiveModule('vertical')} />;
      case 'import':
        return <ImportScreen />;
      case 'preview':
        return <PreviewScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'rendering':
        return <RenderScreen />;
      case 'complete':
        return <CompleteScreen />;
      case 'batch_progress':
        return <BatchProgressScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="flex flex-row h-full overflow-hidden bg-bg-dark">
      {/* Relink overlay screen */}
      {isRelinking && <RelinkScreen />}

      {/* Left Collapsible Sidebar */}
      <Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />

      {/* Main Right Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Streamlined Top Header */}
        <header className="bg-bg-panel border-b border-border-dark py-3 px-6 flex justify-between items-center shrink-0 shadow-md">
          
          {/* Left Breadcrumb & Project Name */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Storyboard Tool</span>
            {projectName && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-[11px] font-semibold text-primary-light bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 max-w-[200px] truncate" title={projectName}>
                  {projectName}
                </span>
                {isUnsaved && (
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Thay đổi chưa lưu"></span>
                )}
              </>
            )}
          </div>

          {/* Center: Stepper progress tracker (only shown for project flow) */}
          {isProjectActive && activeModule === 'storyboard' && (
            <div className="hidden lg:flex items-center gap-3">
              {STEPS.map((s, i) => {
                const isCompleted = i < currentIdx;
                const isActive = i === currentIdx;
                
                return (
                  <React.Fragment key={s.id}>
                    {i > 0 && (
                      <div className={`w-6 h-0.5 ${i <= currentIdx ? 'bg-primary/50' : 'bg-border-dark'}`}></div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div 
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${isActive ? 'bg-primary border-primary text-white font-black animate-pulse' : isCompleted ? 'bg-accent/15 border-accent text-accent' : 'border-border-dark text-gray-500 bg-bg-card'}`}
                      >
                        {i + 1}
                      </div>
                      <span 
                        className={`text-[11px] font-medium transition-colors ${isActive ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-500'}`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Right: Actions menu inside workflow */}
          <div className="flex items-center gap-3">
            {isProjectActive && activeModule === 'storyboard' && (
              <div className="flex items-center gap-2.5">
                {showToast && (
                  <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1 bg-green-950/20 border border-green-500/15 px-2 py-1 rounded-lg animate-in fade-in slide-in-from-right-3 duration-200">
                    <Check className="w-3 h-3" />
                    Đã lưu!
                  </span>
                )}

                <button
                  onClick={handleSaveClick}
                  className="p-2 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 hover:text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Lưu cấu hình (Save)"
                >
                  <Save className="w-4 h-4" />
                  Lưu
                </button>

                <button
                  onClick={handleSaveAsClick}
                  className="p-2 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 hover:text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Lưu thành bản mới (Save As)"
                >
                  <Copy className="w-4 h-4" />
                  Lưu mới
                </button>

                <button
                  onClick={handleExitClick}
                  className="p-2 bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-red-900 text-gray-300 hover:text-red-400 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Quay lại Dashboard"
                >
                  <Library className="w-4 h-4" />
                  Thư viện
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 py-4 bg-bg-dark">
          <div className="max-w-7xl mx-auto h-full">
            {renderActiveScreen()}
          </div>
        </main>

      {/* App Footer */}
      <footer className="bg-bg-panel border-t border-border-dark/60 py-2 px-6 text-center text-[10px] text-gray-600 shrink-0">
        Pipeline sản xuất video doodle tự động — Thiết kế tối giản, hiệu quả tối đa. Xử lý local 100%.
      </footer>

      {/* Save Project Modal (For new project) */}
      {saveOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Save className="w-4 h-4 text-primary" />
              Lưu dự án mới
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500">Tên dự án</label>
              <input 
                type="text" 
                placeholder="Nhập tên dự án..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-3 py-2 rounded-xl text-xs outline-none font-sans"
              />
              {saveError && (
                <span className="text-[10px] text-red-400 block">{saveError}</span>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSaveOpen(false)}
                className="flex-1 py-2 border border-border-dark text-gray-300 rounded-xl text-xs font-semibold hover:bg-bg-dark cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveSubmit}
                className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover cursor-pointer"
              >
                Lưu dự án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save As Modal */}
      {saveAsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Copy className="w-4 h-4 text-primary" />
              Lưu dự án thành bản mới
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500">Tên dự án mới</label>
              <input 
                type="text" 
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-3 py-2 rounded-xl text-xs outline-none font-sans"
              />
              {saveAsError && (
                <span className="text-[10px] text-red-400 block">{saveAsError}</span>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSaveAsOpen(false)}
                className="flex-1 py-2 border border-border-dark text-gray-300 rounded-xl text-xs font-semibold hover:bg-bg-dark cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveAsSubmit}
                className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover cursor-pointer"
              >
                Lưu mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation modal (FR-2.9) */}
      {exitOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-2 rounded-xl text-yellow-500 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Thay đổi chưa được lưu</h3>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  Dự án hiện tại của anh có các thay đổi chưa được ghi lại. Anh có muốn lưu trước khi quay về Dashboard không?
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleExitSave}
                className="w-full py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover cursor-pointer"
              >
                Lưu và quay về Thư viện
              </button>
              <button
                onClick={handleExitDiscard}
                className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-900/30 text-red-400 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Bỏ qua thay đổi & Thoát
              </button>
              <button
                onClick={() => setExitOpen(false)}
                className="w-full py-2 border border-border-dark text-gray-300 text-xs font-semibold rounded-xl hover:bg-bg-dark cursor-pointer"
              >
                Hủy (Ở lại dự án)
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <MainLayout />
    </ProjectProvider>
  );
}
