/** Instants in milliseconds since Unix epoch (UTC); adapters handle local display. */
export type Instant = number;
export type UserId = string;
export type BoardId = string;
export type MeasurementId = string;
export type ForecastModelId = 'linear-all' | 'linear-last-five';

/** Created by the trusted authentication adapter, never from a request body. */
export interface Actor {
  readonly userId: UserId;
}

export interface BoardSettings {
  readonly name: string;
  readonly unit: string;
  readonly selectedModels: readonly ForecastModelId[];
}

export interface Board extends BoardSettings {
  readonly id: BoardId;
}

export interface MeasurementInput {
  readonly measuredAt: Instant;
  readonly value: number;
}

export interface Measurement extends MeasurementInput {
  readonly id: MeasurementId;
}

export interface BoardSnapshot {
  readonly board: Board;
  /** Ascending measuredAt; equal dates ordered by id for deterministic selection. */
  readonly measurements: readonly Measurement[];
}

export interface ForecastPoint {
  readonly at: Instant;
  readonly value: number;
}

export type Depletion =
  | { readonly status: 'future'; readonly at: Instant; readonly remainingMs: number }
  | { readonly status: 'already-depleted'; readonly at: Instant }
  | { readonly status: 'not-predicted' };

export type Forecast =
  | {
      readonly model: ForecastModelId;
      readonly status: 'insufficient-data';
    }
  | {
      readonly model: ForecastModelId;
      readonly status: 'available';
      readonly usedMeasurementIds: readonly MeasurementId[];
      /** Model values at requested instants, in the same order; no clamping to zero. */
      readonly points: readonly ForecastPoint[];
      readonly depletion: Depletion;
    };

/** Expected failures are values; unexpected infrastructure failures reject the promise. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: 'not-found' } }
  | {
      readonly ok: false;
      readonly error: { readonly code: 'invalid-input'; readonly field: string; readonly message: string };
    };
