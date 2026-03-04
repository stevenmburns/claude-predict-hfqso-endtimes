import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataRecord {
  Band: string;
  Completed: string;
}

interface ChartPoint {
  time: number;
  [band: string]: number;
}

const BANDS = ["17m", "15m", "12m", "10m"];
const COLORS: Record<string, string> = {
  "17m": "#4e79a7",
  "15m": "#f28e2b",
  "12m": "#59a14f",
  "10m": "#e15759",
};

function buildChartData(records: DataRecord[]): ChartPoint[] {
  const counts: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
  const offsets: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));

  // Compute per-band offsets: each band starts where the previous ended
  const bandTotals = Object.fromEntries(BANDS.map((b) => [b, records.filter((r) => r.Band === b).length]));
  let running = 0;
  for (const band of BANDS) {
    offsets[band] = running;
    running += bandTotals[band];
  }

  return records.map((r) => {
    counts[r.Band] += 1;
    const snapshot = Object.fromEntries(
      BANDS.map((b) => [b, b === r.Band ? offsets[b] + counts[b] : null])
    );
    return { time: new Date(r.Completed).getTime(), ...snapshot };
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19) + " UTC";
}

function CustomLegend() {
  const style: CSSProperties = { display: "flex", gap: "1.5rem", justifyContent: "center", padding: "0.5rem 0" };
  return (
    <div style={style}>
      {BANDS.map((band) => (
        <span key={band} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke={COLORS[band]} strokeWidth="2" /></svg>
          {band}
        </span>
      ))}
    </div>
  );
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

export default function App() {
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    fetch("/mock_data.json")
      .then((r) => r.json())
      .then((records: DataRecord[]) => setData(buildChartData(records)));
  }, []);

  const ticks = build30MinTicks(data);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Cumulative Completions by Band</h2>
      <ResponsiveContainer width="100%" height={450}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
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
          <Legend content={<CustomLegend />} />
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
