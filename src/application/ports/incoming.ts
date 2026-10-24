import type {
  Actor,
  Board,
  BoardId,
  BoardSettings,
  BoardSnapshot,
  Forecast,
  Instant,
  Measurement,
  MeasurementId,
  MeasurementInput,
  Result,
} from "../../domain/types.js";

/**
 * Driving port: an authenticated actor is required on every call.
 * Non-owned resources return not-found, just like absent resources.
 * Input validation is performed by the application before calling outgoing ports.
 * Expected failures use Result; unexpected failures reject.
 */
export interface ResourceTracking {
  listBoards(actor: Actor): Promise<Result<readonly Board[]>>;
  createBoard(actor: Actor, settings: BoardSettings): Promise<Result<Board>>;
  getBoard(actor: Actor, boardId: BoardId): Promise<Result<BoardSnapshot>>;
  /** Complete replacement of editable settings; preserves measurements. */
  updateBoard(
    actor: Actor,
    boardId: BoardId,
    settings: BoardSettings,
  ): Promise<Result<Board>>;
  addMeasurement(
    actor: Actor,
    boardId: BoardId,
    input: MeasurementInput,
  ): Promise<Result<Measurement>>;
  updateMeasurement(
    actor: Actor,
    boardId: BoardId,
    measurementId: MeasurementId,
    input: MeasurementInput,
  ): Promise<Result<Measurement>>;
  deleteMeasurement(
    actor: Actor,
    boardId: BoardId,
    measurementId: MeasurementId,
  ): Promise<Result<void>>;
  /** Deletes all measurements atomically; preserves the board and its settings. */
  resetMeasurements(actor: Actor, boardId: BoardId): Promise<Result<void>>;
  /**
   * Calculates selected models from a single owned snapshot.
   * asOf is the reference instant for remaining duration, normally now.
   * sampleAt supplies finite instants for drawing curves, independently of measurement dates.
   * No request can supply an owner id in place of the authenticated actor.
   */
  forecast(
    actor: Actor,
    boardId: BoardId,
    query: { readonly asOf: Instant; readonly sampleAt: readonly Instant[] },
  ): Promise<Result<readonly Forecast[]>>;
}
