import React, { useRef, useState } from 'react';

export interface MaskBox {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  w: number; // percentage 0-100
  h: number; // percentage 0-100
}

interface VideoMaskCanvasProps {
  videoUrl: string;
  mask: MaskBox;
  onChange: (mask: MaskBox) => void;
}

export default function VideoMaskCanvas({ videoUrl, mask, onChange }: VideoMaskCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    setDragStart({ x: xPct, y: yPct });
    setIsDragging(true);
    onChange({ x: xPct, y: yPct, w: 10, h: 5 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const w = Math.max(5, currentX - dragStart.x);
    const h = Math.max(3, currentY - dragStart.y);

    onChange({
      x: Math.max(0, Math.min(100 - w, dragStart.x)),
      y: Math.max(0, Math.min(100 - h, dragStart.y)),
      w: Math.min(100, w),
      h: Math.min(100, h)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const formattedUrl = videoUrl.startsWith('file://') || videoUrl.startsWith('http')
    ? videoUrl
    : `file:///${videoUrl.replace(/\\/g, '/')}`;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative w-full aspect-[9/16] max-h-[360px] bg-black rounded-xl overflow-hidden cursor-crosshair border border-border-dark select-none"
    >
      <video src={formattedUrl} className="w-full h-full object-contain pointer-events-none" controls={false} />

      {/* Bounding Box Overlay */}
      {mask.w > 0 && (
        <div
          style={{
            left: `${mask.x}%`,
            top: `${mask.y}%`,
            width: `${mask.w}%`,
            height: `${mask.h}%`
          }}
          className="absolute border-2 border-yellow-400 bg-yellow-400/20 backdrop-blur-md rounded transition-all flex items-center justify-center pointer-events-none"
        >
          <span className="text-[9px] font-bold text-yellow-300 bg-black/60 px-1 rounded">Vùng mờ phụ đề</span>
        </div>
      )}
    </div>
  );
}
