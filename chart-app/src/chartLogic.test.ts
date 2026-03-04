import { describe, it, expect } from "vitest";
import { buildChartData, build30MinTicks, formatTime, THIRTY_MIN_MS } from "./chartLogic";
import type { DataRecord } from "./chartLogic";

// Helper: build a sequence of completed records spaced exactly `intervalMs` apart
function makeRecords(band: string, count: number, startMs: number, intervalMs: number, completed = true): DataRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    Band: band,
    Completed: completed,
    ...(completed ? { Completed_Timestamp: new Date(startMs + intervalMs * (i + 1)).toISOString() } : {}),
  }));
}

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats a UTC timestamp as HH:MM:SS UTC", () => {
    const ms = new Date("2026-03-04T17:30:00.000Z").getTime();
    expect(formatTime(ms)).toBe("17:30:00 UTC");
  });
});

// ── build30MinTicks ───────────────────────────────────────────────────────────

describe("build30MinTicks", () => {
  it("returns empty array for empty data", () => {
    expect(build30MinTicks([])).toEqual([]);
  });

  it("aligns first tick to next 30-min boundary", () => {
    const start = new Date("2026-03-04T17:31:00.000Z").getTime(); // 1 min past boundary
    const end = new Date("2026-03-04T18:35:00.000Z").getTime();
    const ticks = build30MinTicks([{ time: start }, { time: end }]);
    expect(ticks[0]).toBe(new Date("2026-03-04T18:00:00.000Z").getTime());
  });

  it("produces ticks every 30 minutes", () => {
    const start = new Date("2026-03-04T17:30:00.000Z").getTime();
    const end = new Date("2026-03-04T19:30:00.000Z").getTime();
    const ticks = build30MinTicks([{ time: start }, { time: end }]);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBe(THIRTY_MIN_MS);
    }
  });
});

// ── buildChartData: all completed ─────────────────────────────────────────────

describe("buildChartData — all completed", () => {
  const T0 = new Date("2026-03-04T17:30:00.000Z").getTime();
  const INTERVAL = 60_000; // 1 minute

  const records: DataRecord[] = [
    ...makeRecords("17m", 3, T0, INTERVAL),
    ...makeRecords("15m", 2, T0 + 3 * INTERVAL, INTERVAL),
  ];

  it("returns no predBands", () => {
    const { predBands } = buildChartData(records);
    expect(predBands).toEqual([]);
  });

  it("counts each band from its offset", () => {
    const { data } = buildChartData(records);
    const band17 = data.filter((p) => p["17m"] != null);
    const band15 = data.filter((p) => p["15m"] != null);

    expect(band17[0]["17m"]).toBe(1);
    expect(band17[2]["17m"]).toBe(3);
    // 15m offset = 3 (after 17m)
    expect(band15[0]["15m"]).toBe(4);
    expect(band15[1]["15m"]).toBe(5);
  });

  it("only one band has a non-null value per point", () => {
    const { data } = buildChartData(records);
    for (const point of data) {
      const nonNull = ["17m", "15m", "12m", "10m"].filter((b) => point[b] != null);
      expect(nonNull.length).toBeLessThanOrEqual(1);
    }
  });
});

// ── buildChartData: active band (partial completion) ──────────────────────────

describe("buildChartData — active band", () => {
  const T0 = new Date("2026-03-04T17:30:00.000Z").getTime();
  const INTERVAL = 60_000;

  // 17m fully done (3), 15m partially done (2 completed, 1 pending)
  const records: DataRecord[] = [
    ...makeRecords("17m", 3, T0, INTERVAL),
    ...makeRecords("15m", 2, T0 + 3 * INTERVAL, INTERVAL),
    { Band: "15m", Completed: false },
  ];

  it("identifies 15m as the active pred band", () => {
    const { predBands } = buildChartData(records);
    expect(predBands).toContain("15m");
  });

  it("prediction anchors at the last completed value", () => {
    const { data } = buildChartData(records);
    const predPoints = data.filter((p) => p["15m_pred"] != null);
    // first pred point = offset(15m) + completedCounts(15m) = 3 + 2 = 5
    expect(predPoints[0]["15m_pred"]).toBe(5);
  });

  it("prediction ends at total count", () => {
    const { data } = buildChartData(records);
    const predPoints = data.filter((p) => p["15m_pred"] != null);
    expect(predPoints[predPoints.length - 1]["15m_pred"]).toBe(6);
  });

  it("pred points use mean interval of completed records", () => {
    const { data } = buildChartData(records);
    const predPoints = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    // mean interval of 2 completed 15m records = INTERVAL (uniform spacing)
    expect(predPoints[1].time - predPoints[0].time).toBeCloseTo(INTERVAL, -1);
  });
});

// ── buildChartData: queued band ───────────────────────────────────────────────

describe("buildChartData — queued band", () => {
  const T0 = new Date("2026-03-04T17:30:00.000Z").getTime();
  const INTERVAL = 60_000;

  // 17m done (2), 15m active (1 completed, 1 pending), 12m queued (2 pending)
  const records: DataRecord[] = [
    ...makeRecords("17m", 2, T0, INTERVAL),
    ...makeRecords("15m", 1, T0 + 2 * INTERVAL, INTERVAL),
    { Band: "15m", Completed: false },
    { Band: "12m", Completed: false },
    { Band: "12m", Completed: false },
  ];

  it("includes both 15m and 12m in predBands", () => {
    const { predBands } = buildChartData(records);
    expect(predBands).toEqual(["15m", "12m"]);
  });

  it("queued band prediction starts at active band predicted end value", () => {
    const { data } = buildChartData(records);
    const pred15 = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    const pred12 = data.filter((p) => p["12m_pred"] != null).sort((a, b) => a.time - b.time);

    const activePredEnd = pred15[pred15.length - 1]["15m_pred"] as number;
    expect(pred12[0]["12m_pred"]).toBe(activePredEnd);
  });

  it("queued band prediction end value equals all records count", () => {
    const { data } = buildChartData(records);
    const pred12 = data.filter((p) => p["12m_pred"] != null).sort((a, b) => a.time - b.time);
    // total = 2 (17m) + 2 (15m) + 2 (12m) = 6
    expect(pred12[pred12.length - 1]["12m_pred"]).toBe(6);
  });

  it("queued band starts at active band predicted end time", () => {
    const { data } = buildChartData(records);
    const pred15 = data.filter((p) => p["15m_pred"] != null).sort((a, b) => a.time - b.time);
    const pred12 = data.filter((p) => p["12m_pred"] != null).sort((a, b) => a.time - b.time);
    expect(pred12[0].time).toBe(pred15[pred15.length - 1].time);
  });
});
