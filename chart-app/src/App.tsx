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
import { BANDS, buildChartData, build30MinTicks, formatTime } from "./chartLogic";
import type { ChartResult, DataRecord } from "./chartLogic";

const COLORS: Record<string, string> = {
  "17m": "#4e79a7",
  "15m": "#f28e2b",
  "12m": "#59a14f",
  "10m": "#e15759",
};

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
