export interface DataRecord {
  Band: string;
  Completed: boolean;
  Completed_Timestamp?: string;
}

export interface ChartPoint {
  time: number;
  [key: string]: number | null;
}

export interface BandLabel {
  band: string;
  time: number;
  value: number;
  text: string; // "completed/total"
}

export interface ChartResult {
  data: ChartPoint[];
  predBands: string[];
  bandLabels: BandLabel[];
}

export const BANDS = ["17m", "15m", "12m", "10m"];

// Median inter-arrival interval — robust to outlier gaps from early scattered completions
function medianInterval(times: number[]): number {
  const intervals = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 1
    ? intervals[mid]
    : (intervals[mid - 1] + intervals[mid]) / 2;
}

export function buildChartData(records: DataRecord[]): ChartResult {
  const completed = records
    .filter((r) => r.Completed)
    .sort((a, b) => new Date(a.Completed_Timestamp!).getTime() - new Date(b.Completed_Timestamp!).getTime());
  const completedCounts = Object.fromEntries(BANDS.map((b) => [b, completed.filter((r) => r.Band === b).length]));
  const totalCounts = Object.fromEntries(BANDS.map((b) => [b, records.filter((r) => r.Band === b).length]));

  // Offsets are based on total records per preceding band (fixed slots on y-axis)
  const offsets: Record<string, number> = {};
  let running = 0;
  for (const band of BANDS) {
    offsets[band] = running;
    running += totalCounts[band];
  }

  // Global median inter-arrival interval across all completed QSOs; fallback 1/min
  const allTimes = completed.map((r) => new Date(r.Completed_Timestamp!).getTime());
  const globalMedianInterval = allTimes.length >= 2 ? medianInterval(allTimes) : 60_000;

  // Minimum completions required to trust a band's own rate; below this, use global median
  const MIN_BAND_SAMPLES = 5;

  // Latest known timestamp — anchor for zero-completion band predictions
  const latestTime = allTimes.length > 0 ? allTimes[allTimes.length - 1] : 0;

  // Actual data points
  const counts: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
  const data: ChartPoint[] = completed.map((r) => {
    counts[r.Band] += 1;
    const snapshot = Object.fromEntries(BANDS.map((b) => [b, b === r.Band ? offsets[b] + counts[b] : null]));
    return { time: new Date(r.Completed_Timestamp!).getTime(), ...snapshot };
  });

  const predBands: string[] = [];
  const bandLabels: BandLabel[] = [];
  const nullSnapshot = Object.fromEntries(BANDS.map((b) => [b, null]));

  // chainTime tracks the predicted end of the last processed band, used in sequential mode
  let chainTime = latestTime;

  for (const band of BANDS) {
    const total = totalCounts[band];
    const done = completedCounts[band];
    const pending = total - done;

    if (total === 0) continue;

    const bandTimes = completed
      .filter((r) => r.Band === band)
      .map((r) => new Date(r.Completed_Timestamp!).getTime());

    if (pending === 0) {
      // Fully completed — label only
      chainTime = Math.max(bandTimes[bandTimes.length - 1], chainTime);
      bandLabels.push({ band, time: bandTimes[bandTimes.length - 1], value: offsets[band] + total, text: `${total}/${total}` });
      continue;
    }

    predBands.push(band);
    const predKey = `${band}_pred`;

    const meanInterval = done >= MIN_BAND_SAMPLES ? medianInterval(bandTimes) : globalMedianInterval;
    const lastBandTime = done > 0 ? bandTimes[bandTimes.length - 1] : -Infinity;
    const predStart = Math.max(lastBandTime, chainTime, latestTime);

    const predEnd = predStart + pending * meanInterval;
    chainTime = predEnd;

    data.push({ time: predStart, ...nullSnapshot, [predKey]: offsets[band] + done });
    data.push({ time: predEnd, ...nullSnapshot, [predKey]: offsets[band] + total });
    bandLabels.push({ band, time: predEnd, value: offsets[band] + total, text: `${done}/${total}` });
  }

  data.sort((a, b) => a.time - b.time);
  return { data, predBands, bandLabels };
}

export const THIRTY_MIN_MS = 30 * 60 * 1000;

export function build30MinTicks(data: ChartPoint[]): number[] {
  if (data.length === 0) return [];
  const start = Math.ceil(data[0].time / THIRTY_MIN_MS) * THIRTY_MIN_MS;
  const end = data[data.length - 1].time;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += THIRTY_MIN_MS) ticks.push(t);
  return ticks;
}

export function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}
