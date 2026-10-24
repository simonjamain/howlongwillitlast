import type { ResourceTracking } from "./ports/incoming.js";
import type { BoardStore, ForecastEngine } from "./ports/outgoing.js";
import type {
  Actor,
  Board,
  BoardSnapshot,
  Forecast,
  Measurement,
  BoardId,
  BoardSettings,
  Instant,
  MeasurementId,
  MeasurementInput,
  Result,
} from "../domain/types.js";

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const missing = <T>(): Result<T> => ({
  ok: false,
  error: { code: "not-found" },
});
const invalid = <T>(field: string, message: string): Result<T> => ({
  ok: false,
  error: { code: "invalid-input", field, message },
});
const instant = (value: number) =>
  Number.isSafeInteger(value) && Math.abs(value) <= 8.64e15;
function settingsError(value: BoardSettings): string | undefined {
  if (!value.name.trim() || value.name.length > 120) return "name";
  if (value.unit.length > 40) return "unit";
  if (
    value.selectedModels.length > 2 ||
    new Set(value.selectedModels).size !== value.selectedModels.length ||
    value.selectedModels.some(
      (m) => m !== "linear-all" && m !== "linear-last-five",
    )
  )
    return "selectedModels";
}
function readingError(value: MeasurementInput): string | undefined {
  if (!instant(value.measuredAt)) return "measuredAt";
  if (!Number.isFinite(value.value) || Math.abs(value.value) > 1e12)
    return "value";
}

/** Application orchestration; transport schemas reject malformed object shapes. */
export class TrackingService implements ResourceTracking {
  constructor(
    private readonly store: BoardStore,
    private readonly engine: ForecastEngine,
  ) {}
  async listBoards(actor: Actor): Promise<Result<readonly Board[]>> {
    return ok(await this.store.list(actor));
  }
  async createBoard(
    actor: Actor,
    settings: BoardSettings,
  ): Promise<Result<Board>> {
    const field = settingsError(settings);
    if (field) return invalid<Board>(field, "Invalid board settings");
    return ok(
      await this.store.create(actor, {
        ...settings,
        name: settings.name.trim(),
        unit: settings.unit.trim(),
      }),
    );
  }
  async getBoard(actor: Actor, id: BoardId): Promise<Result<BoardSnapshot>> {
    const value = await this.store.get(actor, id);
    return value ? ok(value) : missing();
  }
  async updateBoard(
    actor: Actor,
    id: BoardId,
    settings: BoardSettings,
  ): Promise<Result<Board>> {
    const field = settingsError(settings);
    if (field) return invalid<Board>(field, "Invalid board settings");
    const value = await this.store.update(actor, id, {
      ...settings,
      name: settings.name.trim(),
      unit: settings.unit.trim(),
    });
    return value ? ok(value) : missing();
  }
  async addMeasurement(
    actor: Actor,
    id: BoardId,
    input: MeasurementInput,
  ): Promise<Result<Measurement>> {
    const field = readingError(input);
    if (field) return invalid<Measurement>(field, "Invalid measurement");
    const value = await this.store.addMeasurement(actor, id, input);
    return value ? ok(value) : missing();
  }
  async updateMeasurement(
    actor: Actor,
    id: BoardId,
    measurementId: MeasurementId,
    input: MeasurementInput,
  ): Promise<Result<Measurement>> {
    const field = readingError(input);
    if (field) return invalid<Measurement>(field, "Invalid measurement");
    const value = await this.store.updateMeasurement(
      actor,
      id,
      measurementId,
      input,
    );
    return value ? ok(value) : missing();
  }
  async deleteMeasurement(
    actor: Actor,
    id: BoardId,
    measurementId: MeasurementId,
  ): Promise<Result<void>> {
    return (await this.store.deleteMeasurement(actor, id, measurementId))
      ? ok(undefined)
      : missing<void>();
  }
  async resetMeasurements(actor: Actor, id: BoardId): Promise<Result<void>> {
    return (await this.store.resetMeasurements(actor, id))
      ? ok(undefined)
      : missing<void>();
  }
  async forecast(
    actor: Actor,
    id: BoardId,
    query: { readonly asOf: Instant; readonly sampleAt: readonly Instant[] },
  ): Promise<Result<readonly Forecast[]>> {
    type Output = readonly Forecast[];
    if (!instant(query.asOf))
      return invalid<Output>("asOf", "Invalid reference instant");
    if (query.sampleAt.length > 1000 || query.sampleAt.some((t) => !instant(t)))
      return invalid<Output>("sampleAt", "At most 1000 valid instants");
    const snapshot = await this.store.get(actor, id);
    if (!snapshot) return missing<Output>();
    return ok(
      this.engine.calculate({
        measurements: snapshot.measurements,
        models: snapshot.board.selectedModels,
        ...query,
      }),
    );
  }
}
