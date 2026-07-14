import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  validateSplitPointInputs,
  buildVerticalSegments,
  formatTimestamp,
  buildSegmentTitle,
  buildSegmentFilename
} from '../../shared/verticalSegments.js';

interface Props {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  markerInputs: string[];
  onMarkerInputsChange: (inputs: string[]) => void;
  overlapSeconds: number;
  onOverlapSecondsChange: (seconds: number) => void;
  duration: number | null;
  baseFilename: string;
  title: string;
  onValidationChange: (result: { valid: boolean; splitPoints: number[] }) => void;
}

export default function VerticalSplitSettings(props: Props) {
  const validation = React.useMemo(
    () => validateSplitPointInputs(props.markerInputs, props.duration ?? Number.NaN),
    [props.markerInputs, props.duration]
  );
  const overlapValid = Number.isInteger(props.overlapSeconds) && props.overlapSeconds >= 0 && props.overlapSeconds <= 30;
  const valid = !props.enabled || (validation.valid && overlapValid);
  const splitPointsKey = validation.splitPoints.join(',');
  
  React.useEffect(() => {
    props.onValidationChange({ valid, splitPoints: validation.splitPoints });
  }, [valid, splitPointsKey, props.onValidationChange]);
  
  const segments = props.enabled && valid && props.duration
    ? buildVerticalSegments(props.duration, validation.splitPoints, props.overlapSeconds)
    : [];

  return (
    <section className="space-y-3 rounded-xl border border-border-dark bg-bg-dark p-3">
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(event) => props.onEnabledChange(event.target.checked)}
          className="accent-primary"
        />
        Tách thành nhiều video ngắn
      </label>
      {props.enabled && (
        <>
          <div className="space-y-2">
            {props.markerInputs.map((value, index) => (
              <div key={index} className="space-y-1">
                <div className="flex gap-2">
                  <input
                    value={value}
                    placeholder="MM:SS hoặc HH:MM:SS"
                    onChange={(event) => props.onMarkerInputsChange(
                      props.markerInputs.map((current, i) => i === index ? event.target.value : current)
                    )}
                    className="flex-1 rounded-lg border border-border-dark bg-bg-panel px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    aria-label={`Xóa mốc ${index + 1}`}
                    onClick={() => props.onMarkerInputsChange(props.markerInputs.filter((_, i) => i !== index))}
                    className="rounded-lg border border-red-500/30 px-2 text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {validation.errors[index] && <p className="text-[10px] text-red-400">{validation.errors[index]}</p>}
              </div>
            ))}
            <button
              type="button"
              onClick={() => props.onMarkerInputsChange([...props.markerInputs, ''])}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Plus className="h-4 w-4" /> Thêm mốc
            </button>
          </div>
          <label className="block text-xs text-gray-400">
            Chồng lấn (giây)
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={props.overlapSeconds}
              onChange={(event) => props.onOverlapSecondsChange(Number(event.target.value))}
              className="ml-2 w-20 rounded-lg border border-border-dark bg-bg-panel px-2 py-1 text-white text-xs"
            />
          </label>
          {!overlapValid && <p className="text-[10px] text-red-400">Overlap phải là số nguyên từ 0 đến 30.</p>}
          {segments.length > 0 && (
            <div className="space-y-1 rounded-lg border border-border-dark p-2 text-[10px] text-gray-400 bg-bg-panel/50">
              <p className="font-semibold text-gray-300 border-b border-border-dark pb-1 mb-1">Xem trước phân đoạn:</p>
              {segments.map((segment) => (
                <div key={segment.index} className="py-1 border-b border-border-dark/30 last:border-b-0">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-300">Đoạn {segment.index}:</span>
                    <span>{formatTimestamp(segment.startTime)} → {formatTimestamp(segment.endTime)} ({Math.round(segment.duration)}s)</span>
                  </div>
                  <div>Tiêu đề: <span className="text-gray-300">{buildSegmentTitle(props.title, segment.index) || '(không có)'}</span></div>
                  <div className="font-mono text-accent truncate">File: {buildSegmentFilename(props.baseFilename, segment.index)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
