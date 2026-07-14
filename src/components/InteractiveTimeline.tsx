import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ZoomIn, Volume2, Shuffle, Clock, RefreshCcw, X } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { recalculateStartTimes } from '../context/ProjectContext';

// Helper to format seconds to mm:ss.m
const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};

// --- Sortable Item Component ---
interface SortableImageBlockProps {
  file: any;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDurationChange: (id: string, newDuration: number) => void;
  onDelete: (id: string) => void;
  kenBurnsEnabled: boolean;
  showTransition: boolean;
  transitionData?: any;
  transitionType: string;
  transitionDuration: number;
}

function SortableImageBlock({ 
  file, index, isSelected, onSelect, onDurationChange, onDelete,
  kenBurnsEnabled, showTransition, transitionData, transitionType, transitionDuration 
}: SortableImageBlockProps) {
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: file.path });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const [localDuration, setLocalDuration] = useState(file.duration);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(file.duration.toString());

  useEffect(() => {
    if (!isResizing) {
      setLocalDuration(file.duration);
      setEditValue(file.duration.toFixed(1));
    }
  }, [file.duration, isResizing]);

  // Width is proportional to duration (min 90px, max 400px)
  const PIXELS_PER_SECOND = 20;
  const blockWidth = Math.max(90, Math.min(400, localDuration * PIXELS_PER_SECOND));

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startDuration = localDuration;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDuration = deltaX / PIXELS_PER_SECOND;
      const newDuration = Math.max(0.5, startDuration + deltaDuration); // Min 0.5s
      setLocalDuration(newDuration);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      setIsResizing(false);
      
      const finalDeltaX = upEvent.clientX - startX;
      const finalDuration = Math.max(0.5, startDuration + (finalDeltaX / PIXELS_PER_SECOND));
      onDurationChange(file.path, finalDuration);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0.5) {
      onDurationChange(file.path, val);
    } else {
      setEditValue(file.duration.toFixed(1));
    }
    setIsEditing(false);
  };

  const localImgUrl = `media://${encodeURIComponent(file.path)}`;

  return (
    <div className="flex items-center" style={style}>
      {/* Main Block */}
      <div 
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        style={{ width: `${blockWidth}px`, touchAction: 'none' }}
        className={`group relative flex flex-col justify-between shrink-0 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-colors border-2 select-none h-[140px] ${isSelected ? 'border-primary shadow-lg bg-primary/5' : 'border-border-dark hover:border-gray-500 bg-bg-card'} ${isDragging ? 'opacity-50' : ''}`}
      >
        {/* Delete Button FR-1 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Bạn có chắc chắn muốn xóa ảnh ${file.name} khỏi Timeline?`)) {
              onDelete(file.path);
            }
          }}
          className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 z-30 transition-all hover:scale-110 opacity-0 group-hover:opacity-100 pointer-events-auto cursor-pointer shadow-md"
          title="Xóa ảnh này"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="w-full h-[70px] bg-bg-dark overflow-hidden relative border-b border-border-dark/50 pointer-events-none">
          <img 
            src={localImgUrl} 
            alt={file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {file.isAutoFixed && (
            <div className="absolute top-1 right-1 bg-yellow-500 text-bg-dark rounded-full p-0.5" title="Tự động gán 0.5s">
              <AlertTriangle className="w-3 h-3" />
            </div>
          )}
          {kenBurnsEnabled && (
            <div className="absolute top-1 left-1 bg-primary/80 backdrop-blur rounded p-0.5 text-white" title="Ken Burns BẬT">
              <ZoomIn className="w-3 h-3" />
            </div>
          )}
          <div className="absolute bottom-0 right-1 bg-bg-dark/80 text-[10px] font-mono text-gray-400 px-1.5 rounded-tl">
            #{index + 1}
          </div>
        </div>

        <div className="p-2 text-[10px] flex flex-col justify-between flex-1 pointer-events-none">
          <span className="text-gray-400 font-mono block truncate" title={file.name}>
            {file.name}
          </span>
          {file.sfxName && (
            <div className="flex items-center gap-1 text-[9px] text-primary-light font-mono mt-1 bg-primary/10 px-1 py-0.5 rounded truncate" title={file.sfxName}>
              <Volume2 className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{file.sfxName}</span>
            </div>
          )}
          <div className="flex justify-between items-center mt-auto pt-1 text-[10px] font-mono text-gray-500">
            <span>{formatTime(file.startTime)}</span>
            {isEditing ? (
              <input
                type="number"
                step="0.1"
                min="0.5"
                autoFocus
                className="w-12 bg-bg-dark border border-primary rounded px-1 text-white text-right pointer-events-auto"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEditSave();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
            ) : (
              <span className="text-accent font-bold bg-bg-dark px-1.5 rounded" title="Nhấp đúp để sửa số giây">
                {localDuration.toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          onPointerDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-primary/30 flex items-center justify-center transition-colors z-20"
        >
          <div className="w-0.5 h-6 bg-gray-500 rounded-full"></div>
        </div>
      </div>

      {/* Transition Badge */}
      {showTransition && transitionData && (
        <div className="flex items-center justify-center shrink-0 -mx-2 z-10 pointer-events-none">
          <div 
            className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] shadow-md
              ${transitionData.fallbackHardCut ? "bg-red-950/40 border-red-500/50 text-red-400" : 
                (transitionData.duration < transitionDuration) ? "bg-yellow-950/35 border-yellow-500/50 text-yellow-400" : 
                "bg-primary/20 border-primary/45 text-primary-light"}`}
            title={transitionData.fallbackHardCut ? "Hard Cut" : "Transition"}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Interactive Timeline Component ---
export default function InteractiveTimeline({ 
  selectedFile, setSelectedFile, boundaryTransitions
}: { 
  selectedFile: any, setSelectedFile: (f: any) => void, boundaryTransitions: any[] 
}) {
  const { files, setFiles, setTotalDuration, sfxPool, reShuffleSfx, voiceAudio, transitionEnabled, transitionType, transitionDuration, kenBurnsEnabled, deleteFile } = useProject();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex(f => f.path === active.id);
      const newIndex = files.findIndex(f => f.path === over.id);
      
      const newOrder = arrayMove(files, oldIndex, newIndex);
      const { updatedFiles, newTotalDuration } = recalculateStartTimes(newOrder);
      
      setFiles(updatedFiles);
      // Wait, we don't change totalDuration upon reorder, total is preserved because sum of durations is the same
    }
  };

  const handleDurationChange = (id: string, newDuration: number) => {
    const newFiles = files.map(f => f.path === id ? { ...f, duration: newDuration } : f);
    const { updatedFiles, newTotalDuration } = recalculateStartTimes(newFiles);
    
    setFiles(updatedFiles);
    // Don't call setTotalDuration if voice is overridden to prevent resetting
    if (!voiceAudio) {
      setTotalDuration(newTotalDuration);
    }
  };

  const handleDelete = (filePath: string) => {
    if (selectedFile?.path === filePath) {
      const remaining = files.filter(f => f.path !== filePath);
      setSelectedFile(remaining.length > 0 ? remaining[0] : null);
    }
    deleteFile(filePath);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-semibold text-gray-400">Interactive Timeline (Kéo thả đổi vị trí, Kéo mép phải để đổi thời lượng)</span>
        
        {sfxPool.length > 1 && (
          <button 
            onClick={reShuffleSfx}
            className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary-light px-3 py-1.5 rounded-lg border border-primary/20 hover:border-primary/45 font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Random lại SFX
          </button>
        )}
      </div>

      <div className="w-full overflow-x-auto bg-bg-panel border border-border-dark rounded-2xl p-4 flex flex-col gap-3 min-h-[170px] custom-scrollbar scroll-smooth">
        
        {/* Sortable Row */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={files.map(f => f.path)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-2 items-center min-w-max px-2">
              {files.map((file, index) => (
                <SortableImageBlock 
                  key={file.path}
                  file={file}
                  index={index}
                  isSelected={selectedFile?.path === file.path}
                  onSelect={() => setSelectedFile(file)}
                  onDurationChange={handleDurationChange}
                  onDelete={handleDelete}
                  kenBurnsEnabled={kenBurnsEnabled}
                  showTransition={transitionEnabled && index < files.length - 1}
                  transitionData={boundaryTransitions[index]}
                  transitionType={transitionType}
                  transitionDuration={transitionDuration}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Voice Audio Waveform placeholder */}
        {voiceAudio && (
          <div className="w-full bg-primary/5 border border-primary/20 rounded-xl p-2 h-12 flex items-center gap-[3px] select-none shrink-0 mt-2 min-w-max">
            <Volume2 className="w-4 h-4 text-primary shrink-0 mr-1" />
            <div className="overflow-hidden max-w-[120px] shrink-0 mr-2">
              <span className="text-[10px] text-primary-light font-mono truncate block" title={voiceAudio.name}>
                {voiceAudio.name}
              </span>
            </div>
            
            {/* Dummy Waveform lines */}
            <div className="flex-1 h-full flex items-center justify-between overflow-hidden gap-1">
              {Array.from({ length: Math.min(150, Math.max(50, files.length * 5)) }).map((_, i) => {
                const h = Math.abs(Math.sin(i * 0.2)) * 80 + 10;
                return (
                  <div key={i} style={{ height: `${h}%` }} className="w-[2px] bg-primary/30 rounded-full shrink-0"></div>
                );
              })}
            </div>
            <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-2">{formatTime(voiceAudio.duration)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
