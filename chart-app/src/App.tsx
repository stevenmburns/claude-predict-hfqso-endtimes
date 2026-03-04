import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";

interface DataRecord {
  Band: string;
  Completed: boolean;
  Completed_Timestamp?: string;
}

interface ChartPoint {
  time: number;
  [key: string]: number | null;
}

const BANDS = ["17m", "15m", "12m", "10m"];
const COLORS: Record<string, string> = {
  "17m": "#4e79a7",
  "15m": "#f28e2b",
  "12m": "#59a14f",
  "10m": "#e15759",
};

interface ChartResult {
  data: ChartPoint[];
  predBands: string[];
}

function buildChartData(records: DataRecord[]): ChartResult {
  const completed = records.filter((r) => r.Completed);
  const completedCounts = Object.fromEntries(BANDS.map((b) => [b, completed.filter((r) => r.Band === b).length]));
  const totalCounts = Object.fromEntries(BANDS.map((b) => [b, records.filter((r) => r.Band === b).length]));

  // Offsets based on completed records only
  const offsets: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
  let running = 0;
  for (const band of BANDS) {
    offsets[band] = running;
    running += completedCounts[band];
  }

  // Build chart points from completed records
  const counts: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
  const data: ChartPoint[] = completed.map((r) => {
    counts[r.Band] += 1;
    const snapshot = Object.fromEntries(BANDS.map((b) => [b, b === r.Band ? offsets[b] + counts[b] : null]));
    return { time: new Date(r.Completed_Timestamp!).getTime(), ...snapshot };
  });

  // Global mean interval as fallback for queued bands
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
      // Active band: use its own mean inter-arrival time
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
      // Queued band: chain from previous predicted end using global mean
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

function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19) + " UTC";
}

const THIRTY_MIN_MS = 30 * 60 * 1000;

function build30MinTicks(data: ChartPoint[]): number[] {
  if (data.length === 0) return [];
  const start = Math.ceil(data[0].time / THIRTY_MIN_MS) * THIRTY_MIN_MS;
  const end = data[data.length - 1].time;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += THIRTY_MIN_MS) ticks.push(t);
  return ticks;
}

function CustomLegend({ predBands }: { predBands: string[] }) {
  const style: CSSProperties = { display: "flex", gap: "1.5rem", justifyContent: "center", padding: "0.5rem 0", flexWrap: "wrap" };
  return (
    <div style={style}>
      {BANDS.map((band) => (
        <span key={band} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <svg width="24" height="4">
            <line x1="0" y1="2" x2="24" y2="2" stroke={COLORS[band]} strokeWidth="2" />
          </svg>
          {band}
        </span>
      ))}
      {predBands.map((band) => (
        <span key={`${band}_pred`} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <svg width="24" height="4">
            <line x1="0" y1="2" x2="24" y2="2" stroke={COLORS[band]} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          {band} (predicted)
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [chartResult, setChartResult] = useState<ChartResult>({ data: [], predBands: [] });

  useEffect(() => {
    fetch("/mock_data.json")
      .then((r) => r.json())
      .then((records: DataRecord[]) => setChartResult(buildChartData(records)));
  }, []);

  const { data, predBands } = chartResult;
  const ticks = build30MinTicks(data);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Cumulative Completions by Band</h2>
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            ticks={ticks}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(v) => formatTime(v as number)}
            formatter={(value, name) => [value, name]}
          />
          <Legend content={<CustomLegend predBands={predBands} />} />
          {BANDS.map((band) => (
            <Area
              key={band}
              type="stepAfter"
              dataKey={band}
              stroke={COLORS[band]}
              fill={COLORS[band]}
              fillOpacity={0.15}
              dot={false}
              strokeWidth={2}
            />
          ))}
          {predBands.map((band) => (
            <Line
              key={`${band}_pred`}
              type="linear"
              dataKey={`${band}_pred`}
              stroke={COLORS[band]}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
