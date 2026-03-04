import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
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
  return records.map((r) => {
    counts[r.Band] += 1;
    return { time: new Date(r.Completed).getTime(), ...counts };
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19) + " UTC";
}

export default function App() {
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    fetch("/mock_data.json")
      .then((r) => r.json())
      .then((records: DataRecord[]) => setData(buildChartData(records)));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Cumulative Completions by Band</h2>
      <ResponsiveContainer width="100%" height={450}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tickCount={8}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(v) => formatTime(v as number)}
            formatter={(value, name) => [value, name]}
          />
          <Legend />
          {BANDS.map((band) => (
            <Line
              key={band}
              type="stepAfter"
              dataKey={band}
              stroke={COLORS[band]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
