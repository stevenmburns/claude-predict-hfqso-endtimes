import { describe, it, expect } from "vitest";
import { buildChartData, build30MinTicks, formatTime, THIRTY_MIN_MS, BANDS } from "./chartLogic";
import type { DataRecord } from "./chartLogic";

const T0 = new Date("2026-03-04T17:00:00.000Z").getTime();
const SEC = 1_000;
const MIN = 60 * SEC;

function makeCompleted(band: string, startMs: number, count: number, intervalMs: number): DataRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    Band: band,
    Completed: true,
    Completed_Timestamp: new Date(startMs + intervalMs * (i + 1)).toISOString(),
  }));
}

function makePending(band: string, count: number): DataRecord[] {
  return Array.from({ length: count }, () => ({ Band: band, Completed: false }));
}

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats a UTC timestamp as HH:MM", () => {
    expect(formatTime(new Date("2026-03-04T17:30:00.000Z").getTime())).toBe("17:30");
  });
});

// ── build30MinTicks ───────────────────────────────────────────────────────────

describe("build30MinTicks", () => {
  it("returns empty array for empty data", () => {
    expect(build30MinTicks([])).toEqual([]);
  });

  it("aligns first tick to next 30-min boundary", () => {
    const start = new Date("2026-03-04T17:31:00.000Z").getTime();
    const end = new Date("2026-03-04T18:35:00.000Z").getTime();
    const ticks = build30MinTicks([{ time: start }, { time: end }]);
    expect(ticks[0]).toBe(new Date("2026-03-04T18:00:00.000Z").getTime());
  });

  it("produces ticks spaced exactly 30 minutes apart", () => {
    const start = new Date("2026-03-04T17:30:00.000Z").getTime();
    const end = new Date("2026-03-04T19:30:00.000Z").getTime();
    const ticks = build30MinTicks([{ time: start }, { time: end }]);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBe(THIRTY_MIN_MS);
    }
  });
});

// ── buildChartData: offsets ───────────────────────────────────────────────────

describe("buildChartData — offsets", () => {
  it("offsets are based on totalCounts including pending records", () => {
    // 17m: 3 completed + 2 pending = total 5 → offset for 15m should be 5
    const records = [
      ...makeCompleted("17m", T0, 3, MIN),
      ...makePending("17m", 2),
      ...makeCompleted("15m", T0 + 6 * MIN, 1, MIN),
    ];
    const { data } = buildChartData(records);
    const pt15 = data.find((p) => p["15m"] != null)!;
    expect(pt15["15m"]).toBe(6); // offset(15m) = 5, count = 1
  });

  it("cumulative values within a band start from its offset", () => {
    const records = [
      ...makeCompleted("17m", T0, 3, MIN),
      ...makeCompleted("15m", T0 + 4 * MIN, 2, MIN),
    ];
    const { data } = buildChartData(records);
    const pts17 = data.filter((p) => p["17m"] != null).sort((a, b) => a.time - b.time);
    const pts15 = data.filter((p) => p["15m"] != null).sort((a, b) => a.time - b.time);
    expect(pts17[0]["17m"]).toBe(1);
    expect(pts17[2]["17m"]).toBe(3);
    expect(pts15[0]["15m"]).toBe(4); // offset = 3
    expect(pts15[1]["15m"]).toBe(5);
  });

  it("each actual data point has at most one non-null band value", () => {
    const records = [
      ...makeCompleted("17m", T0, 3, MIN),
      ...makeCompleted("15m", T0 + 4 * MIN, 2, MIN),
    ];
    const { data } = buildChartData(records);
    for (const pt of data) {
      const nonNull = BANDS.filter((b) => pt[b] != null);
      expect(nonNull.length).toBeLessThanOrEqual(1);
    }
  });
});

// ── buildChartData: fully completed bands ─────────────────────────────────────

describe("buildChartData — all completed", () => {
  it("returns no predBands when all records are completed", () => {
    const records = [
      ...makeCompleted("17m", T0, 3, MIN),
      ...makeCompleted("15m", T0 + 4 * MIN, 2, MIN),
    ];
    expect(buildChartData(records).predBands).toEqual([]);
  });

  it("band label has correct text and is placed at the last completion time", () => {
    const records = makeCompleted("17m", T0, 3, MIN);
    const { bandLabels } = buildChartData(records);
    const lbl = bandLabels.find((l) => l.band === "17m")!;
    expect(lbl.text).toBe("3/3");
    expect(lbl.time).toBe(T0 + 3 * MIN);
    expect(lbl.value).toBe(3);
  });
});

// ── buildChartData: prediction series structure ───────────────────────────────

describe("buildChartData — prediction series", () => {
  it("prediction series has exactly two data points per band", () => {
    const records = [
      ...makeCompleted("17m", T0, 5, MIN),
      ...makePending("17m", 3),
    ];
    const { data } = buildChartData(records);
    expect(data.filter((p) => p["17m_pred"] != null)).toHaveLength(2);
  });

  it("prediction series starts at offset + done and ends at offset + total", () => {
    const records = [
      ...makeCompleted("17m", T0, 5, MIN),
      ...makePending("17m", 3),
    ];
    const { data } = buildChartData(records);
    const pts = data.filter((p) => p["17m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(pts[0]["17m_pred"]).toBe(5); // offset=0, done=5
    expect(pts[1]["17m_pred"]).toBe(8); // offset=0, total=8
  });

  it("partial band label shows done/total text and is placed at predEnd", () => {
    const records = [
      ...makeCompleted("17m", T0, 5, MIN),
      ...makePending("17m", 3),
    ];
    const { data, bandLabels } = buildChartData(records);
    const lbl = bandLabels.find((l) => l.band === "17m")!;
    expect(lbl.text).toBe("5/8");
    expect(lbl.value).toBe(8);
    const predPts = data.filter((p) => p["17m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(lbl.time).toBe(predPts[1].time);
  });
});

// ── buildChartData: rate estimation ──────────────────────────────────────────

describe("buildChartData — rate estimation", () => {
  it("uses band's own median interval when done >= 5", () => {
    const INTERVAL = 90 * SEC;
    const records = [
      ...makeCompleted("17m", T0, 5, INTERVAL),
      ...makePending("17m", 4),
    ];
    const { data } = buildChartData(records);
    const pts = data.filter((p) => p["17m_pred"] != null).sort((a, b) => a.time - b.time);
    // 4 pending × 90s = 360s
    expect(pts[1].time - pts[0].time).toBeCloseTo(4 * INTERVAL, -1);
  });

  it("uses global median interval for bands with 1–4 completions", () => {
    const GLOBAL_IV = 30 * SEC;
    // 17m: 6 completions at 30s — establishes global median
    // 15m: 2 completions (below threshold) at 120s — band rate should be ignored
    const records = [
      ...makeCompleted("17m", T0, 6, GLOBAL_IV),
      ...makeCompleted("15m", T0 + 7 * GLOBAL_IV, 2, 120 * SEC),
      ...makePending("15m", 3),
    ];
    const { data } = buildChartData(records);
    const pts = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    // 3 pending × ~30s global median
    expect(pts[1].time - pts[0].time).toBeCloseTo(3 * GLOBAL_IV, -2);
  });

  it("falls back to 60s interval when fewer than 2 total completions exist", () => {
    const records = [
      { Band: "17m", Completed: true, Completed_Timestamp: new Date(T0 + MIN).toISOString() },
      ...makePending("17m", 4),
    ];
    const { data } = buildChartData(records);
    const pts = data.filter((p) => p["17m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(pts[1].time - pts[0].time).toBe(4 * 60_000);
  });
});

// ── buildChartData: predStart clamping ───────────────────────────────────────

describe("buildChartData — predStart clamping", () => {
  it("prediction does not start before the most recent observed QSO across all bands", () => {
    // 15m completions end at T0+5min; 12m has a later completion at T0+10min
    const records = [
      ...makeCompleted("15m", T0, 5, MIN),
      ...makePending("15m", 3),
      { Band: "12m", Completed: true, Completed_Timestamp: new Date(T0 + 10 * MIN).toISOString() },
      ...makePending("12m", 3),
    ];
    const { data } = buildChartData(records);
    const pts15 = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(pts15[0].time).toBeGreaterThanOrEqual(T0 + 10 * MIN);
  });

  it("zero-completion band prediction starts at latestTime", () => {
    const records = [
      ...makeCompleted("17m", T0, 5, MIN),
      ...makePending("15m", 3),
    ];
    const latestTime = T0 + 5 * MIN;
    const { data } = buildChartData(records);
    const pts = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(pts[0].time).toBe(latestTime);
  });
});

// ── buildChartData: sequential chaining ──────────────────────────────────────

describe("buildChartData — sequential chaining", () => {
  it("second zero-completion band starts where the first ends", () => {
    const records = [
      ...makeCompleted("17m", T0, 5, MIN),
      ...makePending("15m", 4),
      ...makePending("12m", 3),
    ];
    const { data } = buildChartData(records);
    const pts15 = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    const pts12 = data.filter((p) => p["12m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(pts12[0].time).toBe(pts15[pts15.length - 1].time);
  });

  it("band with sparse completions waits for the chain before predicting", () => {
    const INTERVAL = MIN;
    // 17m done (establishes chainTime), 15m has 2 sparse completions that ended early
    // 15m's own last completion is before 17m ends — predStart should be clamped
    const records = [
      { Band: "15m", Completed: true, Completed_Timestamp: new Date(T0 + 1 * MIN).toISOString() },
      { Band: "15m", Completed: true, Completed_Timestamp: new Date(T0 + 2 * MIN).toISOString() },
      ...makeCompleted("17m", T0, 5, INTERVAL), // last 17m at T0+5min
      ...makePending("15m", 3),
    ];
    const { data } = buildChartData(records);
    const pts15 = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    // 15m's own completions ended at T0+2min, but latestTime = T0+5min
    expect(pts15[0].time).toBeGreaterThanOrEqual(T0 + 5 * MIN);
  });
});

// ── buildChartData: input ordering ───────────────────────────────────────────

describe("buildChartData — input ordering", () => {
  it("produces identical results for sorted and reversed input", () => {
    const sorted = makeCompleted("17m", T0, 5, MIN);
    const reversed = [...sorted].reverse();
    const { data: dSorted, bandLabels: lSorted } = buildChartData(sorted);
    const { data: dReversed, bandLabels: lReversed } = buildChartData(reversed);
    expect(dSorted).toEqual(dReversed);
    expect(lSorted).toEqual(lReversed);
  });
});

// ── buildChartData: bands with no records ─────────────────────────────────────

describe("buildChartData — empty bands", () => {
  it("bands with no records are skipped entirely", () => {
    const records = makeCompleted("17m", T0, 3, MIN);
    const { predBands, bandLabels } = buildChartData(records);
    expect(predBands).toEqual([]);
    expect(bandLabels.every((l) => l.band === "17m")).toBe(true);
  });

  it("returns empty data for empty input", () => {
    const { data, predBands, bandLabels } = buildChartData([]);
    expect(data).toEqual([]);
    expect(predBands).toEqual([]);
    expect(bandLabels).toEqual([]);
  });
});
