import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { SqliteBoardStore } from "./adapters/sqlite/store.js";
import { createApp } from "./adapters/http/app.js";
import { TrackingService } from "./application/tracking-service.js";
import { LinearForecastEngine } from "./domain/linear-forecast.js";

const authMode = process.env.AUTH_MODE ?? "proxy";
if (authMode !== "proxy" && authMode !== "development")
  throw new Error("AUTH_MODE must be proxy or development");
if (authMode === "development" && process.env.NODE_ENV === "production")
  throw new Error("Development authentication is forbidden in production");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT");
const store = new SqliteBoardStore(
  process.env.DATABASE_PATH ?? "data/app.sqlite",
);
const root = resolve("dist/web");
const app = createApp(new TrackingService(store, new LinearForecastEngine()), {
  authMode,
  identityHeader: process.env.IDENTITY_HEADER ?? "x-forwarded-user",
  production: process.env.NODE_ENV === "production",
  logger: true,
  ...(existsSync(root) ? { staticRoot: root } : {}),
});
app.addHook("onClose", async () => store.close());
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
