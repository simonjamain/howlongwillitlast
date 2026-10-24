import type {
  Depletion,
  Forecast,
  ForecastModelId,
  Instant,
  Measurement,
} from "./types.js";

/** Ordinary least squares, centered in time and value to limit rounding errors. */
export class LinearForecastEngine {
  calculate(input: {
    readonly measurements: readonly Measurement[];
    readonly models: readonly ForecastModelId[];
    readonly asOf: Instant;
    readonly sampleAt: readonly Instant[];
  }): readonly Forecast[] {
    const ordered = [...input.measurements].sort(
      (a, b) =>
        a.measuredAt - b.measuredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    return input.models.map((model) => {
      const rows = model === "linear-last-five" ? ordered.slice(-5) : ordered;
      const first = rows[0];
      if (!first || new Set(rows.map((r) => r.measuredAt)).size < 2)
        return { model, status: "insufficient-data" };
      // Relative days avoid squaring Unix timestamps and preserve irregular intervals.
      const day = 86400000;
      const xs = rows.map((r) => (r.measuredAt - first.measuredAt) / day);
      const meanX = xs.reduce((a, b) => a + b, 0) / rows.length;
      const meanY = rows.reduce((s, r) => s + r.value, 0) / rows.length;
      let covariance = 0,
        variance = 0;
      rows.forEach((r, i) => {
        const dx = xs[i]! - meanX;
        covariance += dx * (r.value - meanY);
        variance += dx * dx;
      });
      const slope = covariance / variance;
      const predict = (at: number) =>
        meanY + slope * ((at - first.measuredAt) / day - meanX);
      let depletion: Depletion = { status: "not-predicted" };
      if (slope < 0) {
        const at = first.measuredAt + (meanX - meanY / slope) * day;
        if (Number.isFinite(at) && Math.abs(at) <= 8.64e15)
          depletion =
            at > input.asOf
              ? { status: "future", at, remainingMs: at - input.asOf }
              : { status: "already-depleted", at };
      }
      return {
        model,
        status: "available",
        usedMeasurementIds: rows.map((r) => r.id),
        points: input.sampleAt.map((at) => ({ at, value: predict(at) })),
        depletion,
      };
    });
  }
}
