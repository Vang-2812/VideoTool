export interface VerticalSegment { index: number; startTime: number; endTime: number; duration: number }
export type TimestampResult = { ok: true; seconds: number } | { ok: false; error: string };
export function parseTimestamp(value: string): TimestampResult;
export function formatTimestamp(seconds: number): string;
export function validateSplitPointInputs(inputs: string[], duration: number): { valid: boolean; splitPoints: number[]; errors: Array<string | null> };
export function buildVerticalSegments(duration: number, splitPoints: number[], overlapSeconds: number): VerticalSegment[];
export function buildSegmentTitle(title: string, index: number): string;
export function buildSegmentFilename(baseName: string, index: number): string;
export function normalizeProjectSplitConfig(project: { vertical_split_enabled?: boolean; vertical_split_points?: number[]; vertical_overlap_seconds?: number }): { enabled: boolean; splitPoints: number[]; overlapSeconds: number };
