import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { BoardStore } from "../../application/ports/outgoing.js";
import type {
  Actor,
  BoardId,
  BoardSettings,
  MeasurementId,
  MeasurementInput,
} from "../../domain/types.js";
import { boards, measurements } from "./schema.js";

export class SqliteBoardStore implements BoardStore {
  private readonly sqlite: Database.Database;
  private readonly db;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path);
    this.sqlite.pragma("foreign_keys = ON");
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("busy_timeout = 5000");
    // Versioned, transactional bootstrap migration; future changes add a new version.
    this.sqlite.transaction(() => {
      const version = this.sqlite.pragma("user_version", {
        simple: true,
      }) as number;
      if (version > 1)
        throw new Error("Database schema newer than this application");
      if (version === 0) {
        this.sqlite
          .exec(`CREATE TABLE boards(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, unit TEXT NOT NULL, selected_models TEXT NOT NULL);
          CREATE INDEX boards_owner_idx ON boards(owner_id);
          CREATE TABLE measurements(id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, measured_at INTEGER NOT NULL, value REAL NOT NULL);
          CREATE INDEX measurements_board_date_idx ON measurements(board_id, measured_at);
          PRAGMA user_version = 1;`);
      }
    })();
    this.db = drizzle(this.sqlite);
  }
  close() {
    this.sqlite.close();
  }
  private owned(actor: Actor, id: BoardId) {
    return and(eq(boards.id, id), eq(boards.ownerId, actor.userId));
  }
  private board(actor: Actor, id: BoardId) {
    const row = this.db
      .select()
      .from(boards)
      .where(this.owned(actor, id))
      .get();
    if (!row) return undefined;
    const { ownerId: _, ...board } = row;
    return board;
  }
  async list(actor: Actor) {
    return this.db
      .select({
        id: boards.id,
        name: boards.name,
        unit: boards.unit,
        selectedModels: boards.selectedModels,
      })
      .from(boards)
      .where(eq(boards.ownerId, actor.userId))
      .orderBy(asc(boards.name), asc(boards.id))
      .all();
  }
  async create(actor: Actor, settings: BoardSettings) {
    const board = { id: randomUUID(), ...settings };
    this.db
      .insert(boards)
      .values({ ...board, ownerId: actor.userId })
      .run();
    return { ...board, selectedModels: [...board.selectedModels] };
  }
  async get(actor: Actor, id: BoardId) {
    return this.sqlite.transaction(() => {
      const board = this.board(actor, id);
      if (!board) return undefined;
      const rows = this.db
        .select({
          id: measurements.id,
          measuredAt: measurements.measuredAt,
          value: measurements.value,
        })
        .from(measurements)
        .where(eq(measurements.boardId, id))
        .orderBy(asc(measurements.measuredAt), asc(measurements.id))
        .all();
      return { board, measurements: rows };
    })();
  }
  async update(actor: Actor, id: BoardId, settings: BoardSettings) {
    return this.sqlite.transaction(() => {
      if (!this.board(actor, id)) return undefined;
      this.db.update(boards).set(settings).where(this.owned(actor, id)).run();
      return this.board(actor, id);
    })();
  }
  async addMeasurement(actor: Actor, id: BoardId, input: MeasurementInput) {
    return this.sqlite.transaction(() => {
      if (!this.board(actor, id)) return undefined;
      const reading = { id: randomUUID(), ...input };
      this.db
        .insert(measurements)
        .values({ ...reading, boardId: id })
        .run();
      return reading;
    })();
  }
  async updateMeasurement(
    actor: Actor,
    id: BoardId,
    measurementId: MeasurementId,
    input: MeasurementInput,
  ) {
    return this.sqlite.transaction(() => {
      if (!this.board(actor, id)) return undefined;
      const rows = this.db
        .update(measurements)
        .set(input)
        .where(
          and(eq(measurements.id, measurementId), eq(measurements.boardId, id)),
        )
        .returning({
          id: measurements.id,
          measuredAt: measurements.measuredAt,
          value: measurements.value,
        })
        .all();
      return rows[0];
    })();
  }
  async deleteMeasurement(
    actor: Actor,
    id: BoardId,
    measurementId: MeasurementId,
  ) {
    return this.sqlite.transaction(() => {
      if (!this.board(actor, id)) return false;
      return (
        this.db
          .delete(measurements)
          .where(
            and(
              eq(measurements.id, measurementId),
              eq(measurements.boardId, id),
            ),
          )
          .run().changes > 0
      );
    })();
  }
  async resetMeasurements(actor: Actor, id: BoardId) {
    return this.sqlite.transaction(() => {
      if (!this.board(actor, id)) return false;
      this.db.delete(measurements).where(eq(measurements.boardId, id)).run();
      return true;
    })();
  }
}
