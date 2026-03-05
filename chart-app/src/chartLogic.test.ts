import { describe, it, expect } from "vitest";
import { build30MinTicks, formatTime, THIRTY_MIN_MS } from "./chartLogic";

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats a UTC timestamp as HH:MM", () => {
    const ms = new Date("2026-03-04T17:30:00.000Z").getTime();
    expect(formatTime(ms)).toBe("17:30");
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

  it("produces ticks every 30 minutes", () => {
    const start = new Date("2026-03-04T17:30:00.000Z").getTime();
    const end = new Date("2026-03-04T19:30:00.000Z").getTime();
    const ticks = build30MinTicks([{ time: start }, { time: end }]);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBe(THIRTY_MIN_MS);
    }
  });
});
