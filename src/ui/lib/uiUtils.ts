export const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`;

export const formatTime = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export interface WindowedRange {
  start: number;
  end: number;
}

export const getWindowedRange = (cursor: number, total: number, windowSize: number): WindowedRange => {
  if (total <= windowSize) {
    return { start: 0, end: total };
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(0, cursor - half);
  let end = start + windowSize;

  if (end > total) {
    end = total;
    start = Math.max(0, end - windowSize);
  }

  return { start, end };
};
