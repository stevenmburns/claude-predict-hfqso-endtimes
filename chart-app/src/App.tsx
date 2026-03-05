import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceDot,
} from "recharts";
import { BANDS, buildChartData, build30MinTicks, formatTime } from "./chartLogic";
import type { DataRecord, BandLabel } from "./chartLogic";

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

function BandLabelDot({ cx, cy, color, text }: { cx: number; cy: number; color: string; text: string }) {
  return (
    <text x={cx - 6} y={cy - 8} textAnchor="end" fontSize={11} fontFamily="sans-serif" fill={color}>
      {text}
    </text>
  );
}

const DATA_SOURCES: Record<string, string> = {
  "Standard mock": "/mock_data.json",
  "Mixed 1 (early completions)": "/mixed_data.json",
  "Mixed 2 (mid-session, 10m not started)": "/mixed_data2.json",
  "Mixed 3 (very early, 17m just started)": "/mixed_data3.json",
  "Mixed 4 (all bands active)": "/mixed_data4.json",
  "Mixed 5 (late session, only 10m remains)": "/mixed_data5.json",
  "Mixed 6 (15m just hit rate threshold)": "/mixed_data6.json",
};

export default function App() {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [source, setSource] = useState(Object.keys(DATA_SOURCES)[0]);
  const chartResult = buildChartData(records);

  useEffect(() => {
    fetch(DATA_SOURCES[source])
      .then((r) => r.json())
      .then((data: DataRecord[]) => setRecords(data));
  }, [source]);

  const { data, predBands, bandLabels } = chartResult;
  const ticks = build30MinTicks(data);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Cumulative Completions by Band</h2>
      <div style={{ marginBottom: "0.75rem" }}>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          {Object.keys(DATA_SOURCES).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
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
            <Area
              key={`${band}_pred`}
              type="linear"
              dataKey={`${band}_pred`}
              stroke={COLORS[band]}
              fill={COLORS[band]}
              fillOpacity={0.07}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              connectNulls={true}
            />
          ))}
          {bandLabels.map((lbl: BandLabel) => (
            <ReferenceDot
              key={`label-${lbl.band}`}
              x={lbl.time}
              y={lbl.value}
              r={0}
              label={<BandLabelDot cx={0} cy={0} color={COLORS[lbl.band]} text={lbl.text} />}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
