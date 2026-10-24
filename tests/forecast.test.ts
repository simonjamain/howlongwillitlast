import { describe, expect, it } from "vitest";
import { LinearForecastEngine } from "../src/domain/linear-forecast.js";

const day = 86400000;
const origin = Date.UTC(2026, 9, 1);
const points = [0, 1, 4].map((d, i) => ({
  id: String(i),
  measuredAt: origin + d * day,
  value: 100 - 10 * d,
}));
describe("forecast contract", () => {
  it("uses elapsed time for irregular measurements and forecasts an exact known depletion date", () => {
    const [result] = new LinearForecastEngine().calculate({
      measurements: points,
      models: ["linear-all"],
      asOf: origin + 5 * day,
      sampleAt: [origin + 6 * day],
    });
    expect(result).toMatchObject({
      status: "available",
      points: [{ at: origin + 6 * day, value: 40 }],
      depletion: {
        status: "future",
        at: origin + 10 * day,
        remainingMs: 5 * day,
      },
    });
  });
  it("selects by measurement date, not entry order, with up to five points", () => {
    const old = { id: "old", measuredAt: origin - 100 * day, value: 9000 };
    const recent = [0, 1, 2, 3, 4].map((d) => ({
      id: String(d),
      measuredAt: origin + d * day,
      value: 100 - 10 * d,
    }));
    const [result] = new LinearForecastEngine().calculate({
      measurements: [
        recent[3]!,
        old,
        recent[1]!,
        recent[4]!,
        recent[0]!,
        recent[2]!,
      ],
      models: ["linear-last-five"],
      asOf: origin,
      sampleAt: [],
    });
    expect(result).toMatchObject({
      usedMeasurementIds: ["0", "1", "2", "3", "4"],
      depletion: { status: "future", at: origin + 10 * day },
    });
    const [early] = new LinearForecastEngine().calculate({
      measurements: points.slice(0, 2),
      models: ["linear-last-five"],
      asOf: origin,
      sampleAt: [],
    });
    expect(early).toMatchObject({
      status: "available",
      usedMeasurementIds: ["0", "1"],
    });
  });
  it("keeps model order and reports insufficient distinct dates", () => {
    const result = new LinearForecastEngine().calculate({
      measurements: [points[0]!, { ...points[0]!, id: "another" }],
      models: ["linear-last-five", "linear-all"],
      asOf: origin,
      sampleAt: [],
    });
    expect(result).toEqual([
      { model: "linear-last-five", status: "insufficient-data" },
      { model: "linear-all", status: "insufficient-data" },
    ]);
  });
  it.each([0, 10])("does not announce depletion for slope %s", (slope) => {
    const readings = [0, 1].map((d) => ({
      id: String(d),
      measuredAt: origin + d * day,
      value: 100 + slope * d,
    }));
    expect(
      new LinearForecastEngine().calculate({
        measurements: readings,
        models: ["linear-all"],
        asOf: origin,
        sampleAt: [],
      }),
    ).toMatchObject([{ depletion: { status: "not-predicted" } }]);
  });
  it("distinguishes past depletion and leaves negative predicted values intact", () => {
    const [result] = new LinearForecastEngine().calculate({
      measurements: points,
      models: ["linear-all"],
      asOf: origin + 12 * day,
      sampleAt: [origin + 11 * day],
    });
    expect(result).toMatchObject({
      depletion: { status: "already-depleted", at: origin + 10 * day },
    });
    if (result?.status !== "available") throw new Error("Expected forecast");
    expect(result.points[0]!.value).toBeCloseTo(-10, 10);
  });
});
