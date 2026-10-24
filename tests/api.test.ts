import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/adapters/http/app.js";
import { SqliteBoardStore } from "../src/adapters/sqlite/store.js";
import { TrackingService } from "../src/application/tracking-service.js";
import { LinearForecastEngine } from "../src/domain/linear-forecast.js";

const settings = {
  name: "Fuel",
  unit: "cm",
  selectedModels: ["linear-all", "linear-last-five"],
};
const headers = (user = "alice") => ({
  "x-forwarded-user": user,
  "x-requested-with": "howlongwillitlast",
});
const cleanups: Array<() => Promise<unknown> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
function setup(path = ":memory:") {
  const store = new SqliteBoardStore(path);
  const app = createApp(
    new TrackingService(store, new LinearForecastEngine()),
    { authMode: "proxy", identityHeader: "x-forwarded-user", production: true },
  );
  app.addHook("onClose", async () => store.close());
  cleanups.push(() => app.close());
  return app;
}
describe("authenticated application with real SQLite", () => {
  it("rejects missing identity, cross-site mutations and invalid payloads", async () => {
    const app = setup();
    expect((await app.inject("/api/boards")).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/boards",
          headers: { "x-forwarded-user": "alice" },
          payload: settings,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/boards",
          headers: headers(),
          payload: { ...settings, ownerId: "bob" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/boards",
          headers: headers(),
          payload: { ...settings, name: "  " },
        })
      ).statusCode,
    ).toBe(400);
    expect((await app.inject("/healthz")).statusCode).toBe(200);
  });
  it("persists edited readings across reopening and resets only the readings", async () => {
    const directory = mkdtempSync(join(tmpdir(), "howlong-"));
    cleanups.unshift(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, "test.sqlite");
    let app = setup(path);
    const board = (
      await app.inject({
        method: "POST",
        url: "/api/boards",
        headers: headers(),
        payload: settings,
      })
    ).json();
    const base = "/api/boards/" + board.id;
    const row = (
      await app.inject({
        method: "POST",
        url: base + "/measurements",
        headers: headers(),
        payload: { measuredAt: 1000, value: 100 },
      })
    ).json();
    expect(
      (
        await app.inject({
          method: "PUT",
          url: base + "/measurements/" + row.id,
          headers: headers(),
          payload: { measuredAt: 2000, value: 90 },
        })
      ).statusCode,
    ).toBe(200);
    await app.inject({
      method: "POST",
      url: base + "/measurements",
      headers: headers(),
      payload: { measuredAt: 3000, value: 80 },
    });
    const forecast = (
      await app.inject({
        method: "POST",
        url: base + "/forecast",
        headers: headers(),
        payload: { asOf: 3000, sampleAt: [4000] },
      })
    ).json();
    expect(forecast).toMatchObject([
      { depletion: { status: "future", at: 11000, remainingMs: 8000 } },
      { depletion: { status: "future", at: 11000 } },
    ]);
    await app.close();
    cleanups.pop();
    app = setup(path);
    expect(
      (await app.inject({ url: base, headers: headers() })).json().measurements,
    ).toHaveLength(2);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: base + "/measurements/" + row.id,
          headers: headers(),
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: base + "/measurements",
          headers: headers(),
        })
      ).statusCode,
    ).toBe(204);
    const snapshot = (
      await app.inject({ url: base, headers: headers() })
    ).json();
    expect(snapshot).toEqual({ board, measurements: [] });
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: base + "/measurements",
          headers: headers(),
        })
      ).statusCode,
    ).toBe(204);
  });
  it("isolates every board/read/write and rejects a reading id from another board", async () => {
    const app = setup();
    const board = (
      await app.inject({
        method: "POST",
        url: "/api/boards",
        headers: headers(),
        payload: settings,
      })
    ).json();
    const base = "/api/boards/" + board.id;
    const row = (
      await app.inject({
        method: "POST",
        url: base + "/measurements",
        headers: headers(),
        payload: { measuredAt: 1, value: 50 },
      })
    ).json();
    expect(
      (
        await app.inject({ url: "/api/boards", headers: headers("bob") })
      ).json(),
    ).toEqual([]);
    for (const [method, suffix, payload] of [
      ["GET", "", undefined],
      ["PUT", "", settings],
      ["POST", "/measurements", { measuredAt: 2, value: 2 }],
      ["PUT", "/measurements/" + row.id, { measuredAt: 2, value: 2 }],
      ["DELETE", "/measurements/" + row.id, undefined],
      ["DELETE", "/measurements", undefined],
      ["POST", "/forecast", { asOf: 1, sampleAt: [] }],
    ] as const) {
      expect(
        (
          await app.inject({
            method,
            url: base + suffix,
            headers: headers("bob"),
            ...(payload ? { payload } : {}),
          })
        ).statusCode,
      ).toBe(404);
    }
    const other = (
      await app.inject({
        method: "POST",
        url: "/api/boards",
        headers: headers(),
        payload: settings,
      })
    ).json();
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/boards/" + other.id + "/measurements/" + row.id,
          headers: headers(),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ url: base, headers: headers() })).json().measurements,
    ).toHaveLength(1);
  });
  it("never permits development bypass in production", () => {
    const store = new SqliteBoardStore(":memory:");
    cleanups.push(() => store.close());
    expect(() =>
      createApp(new TrackingService(store, new LinearForecastEngine()), {
        authMode: "development",
        identityHeader: "x-forwarded-user",
        production: true,
      }),
    ).toThrow("forbidden");
  });
});
