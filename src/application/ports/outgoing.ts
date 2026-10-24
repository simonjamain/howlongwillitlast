import type {
  Actor,
  Board,
  BoardId,
  BoardSettings,
  BoardSnapshot,
  Forecast,
  ForecastModelId,
  Instant,
  Measurement,
  MeasurementId,
  MeasurementInput,
} from "../../domain/types.js";

/**
 * Persistence port, independent of SQLite/Drizzle.
 * Each operation atomically checks ownership with the read/write itself.
 * undefined/false means absent OR non-owned; infrastructure errors reject.
 * Implementations generate unique stable ids, and return detached snapshots.
 * Every measurement operation checks both its board and measurement membership.
 */
export interface BoardStore {
  list(actor: Actor): Promise<readonly Board[]>;
  create(actor: Actor, settings: BoardSettings): Promise<Board>;
  /** Board, settings and ordered measurements read from one consistent snapshot. */
  get(actor: Actor, boardId: BoardId): Promise<BoardSnapshot | undefined>;
  update(
    actor: Actor,
    boardId: BoardId,
    settings: BoardSettings,
  ): Promise<Board | undefined>;
  addMeasurement(
    actor: Actor,
    boardId: BoardId,
    input: MeasurementInput,
  ): Promise<Measurement | undefined>;
  updateMeasurement(
    actor: Actor,
    boardId: BoardId,
    measurementId: MeasurementId,
    input: MeasurementInput,
  ): Promise<Measurement | undefined>;
  deleteMeasurement(
    actor: Actor,
    boardId: BoardId,
    measurementId: MeasurementId,
  ): Promise<boolean>;
  /** true also for an owned board that already has no measurements. */
  resetMeasurements(actor: Actor, boardId: BoardId): Promise<boolean>;
}

/**
 * Pure calculation contract: no persistence, clock, identity or chart dependency.
 * Implementations sort by measuredAt then id and apply the model's own window.
 * Both initial models require at least two distinct dates in that window.
 * linear-last-five uses up to five most recent measurements, even before five exist.
 * Regression uses elapsed time, not sample index. asOf determines depletion status.
 * Non-decreasing trends yield not-predicted; a crossing <= asOf is already-depleted.
 * Inputs have already been validated: finite instants/values and known model ids.
 * Returns exactly one Forecast per requested model, in request order, including insufficient-data.
 * Empty sampleAt is valid when only a depletion estimate is needed.
 */
export interface ForecastEngine {
  calculate(input: {
    readonly measurements: readonly Measurement[];
    readonly models: readonly ForecastModelId[];
    readonly asOf: Instant;
    readonly sampleAt: readonly Instant[];
  }): readonly Forecast[];
}
