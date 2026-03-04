export interface DataRecord {
  Band: string;
  Completed: boolean;
  Completed_Timestamp?: string;
}

export interface ChartPoint {
  time: number;
  [key: string]: number | null;
}

export interface ChartResult {
  data: ChartPoint[];
  predBands: string[];
}

export const BANDS = ["17m", "15m", "12m", "10m"];

export function buildChartData(records: DataRecord[]): ChartResult {
  const completed = records.filter((r) => r.Completed);
  const completedCounts = Object.fromEntries(BANDS.map((b) => [b, completed.filter((r) => r.Band === b).length]));
  const totalCounts = Object.fromEntries(BANDS.map((b) => [b, records.filter((r) => r.Band === b).length]));

  const offsets: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
  let running = 0;
  for (const band of BANDS) {
    offsets[band] = running;
    running += completedCounts[band];
  }

  const counts: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
  const data: ChartPoint[] = completed.map((r) => {
    counts[r.Band] += 1;
    const snapshot = Object.fromEntries(BANDS.map((b) => [b, b === r.Band ? offsets[b] + counts[b] : null]));
    return { time: new Date(r.Completed_Timestamp!).getTime(), ...snapshot };
  });

  const allTimes = completed.map((r) => new Date(r.Completed_Timestamp!).getTime()).sort((a, b) => a - b);
  const globalIntervals = allTimes.slice(1).map((t, i) => t - allTimes[i]);
  const globalMeanInterval = globalIntervals.length > 0
    ? globalIntervals.reduce((a, b) => a + b, 0) / globalIntervals.length
    : 60_000;

  const predBands: string[] = [];
  let chainTime: number | null = null;
  let chainCount: number | null = null;

  for (const band of BANDS) {
    const pendingCount = totalCounts[band] - completedCounts[band];
    if (pendingCount === 0) continue;

    const predKey = `${band}_pred`;
    const nullSnapshot = Object.fromEntries(BANDS.map((b) => [b, null]));
    predBands.push(band);

    if (completedCounts[band] > 0) {
      const bandTimes = completed
        .filter((r) => r.Band === band)
        .map((r) => new Date(r.Completed_Timestamp!).getTime());
      const intervals = bandTimes.slice(1).map((t, i) => t - bandTimes[i]);
      const meanInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : globalMeanInterval;

      const lastTime = bandTimes[bandTimes.length - 1];
      const lastCount = offsets[band] + completedCounts[band];

      data.push({ time: lastTime, ...nullSnapshot, [predKey]: lastCount });
      for (let i = 1; i <= pendingCount; i++) {
        data.push({ time: lastTime + meanInterval * i, ...nullSnapshot, [predKey]: lastCount + i });
      }

      chainTime = lastTime + meanInterval * pendingCount;
      chainCount = lastCount + pendingCount;
    } else {
      const startTime: number = chainTime!;
      const startCount: number = chainCount!;

      data.push({ time: startTime, ...nullSnapshot, [predKey]: startCount });
      for (let i = 1; i <= pendingCount; i++) {
        data.push({ time: startTime + globalMeanInterval * i, ...nullSnapshot, [predKey]: startCount + i });
      }

      chainTime = startTime + globalMeanInterval * pendingCount;
      chainCount = startCount + pendingCount;
    }
  }

  data.sort((a, b) => a.time - b.time);
  return { data, predBands };
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
  return new Date(ms).toISOString().slice(11, 19) + " UTC";
}
