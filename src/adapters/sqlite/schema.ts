import {
  sqliteTable,
  text,
  real,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import type { ForecastModelId } from "../../domain/types.js";
export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    selectedModels: text("selected_models", { mode: "json" })
      .$type<readonly ForecastModelId[]>()
      .notNull(),
  },
  (t) => [index("boards_owner_idx").on(t.ownerId)],
);
export const measurements = sqliteTable(
  "measurements",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    measuredAt: integer("measured_at").notNull(),
    value: real("value").notNull(),
  },
  (t) => [index("measurements_board_date_idx").on(t.boardId, t.measuredAt)],
);
