import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [image] = JSON.parse(
  execFileSync("docker", ["image", "inspect", "howlongwillitlast:ci"], {
    encoding: "utf8",
  }),
);
const labels = image.Config.Labels;
assert.equal(
  labels["org.opencontainers.image.title"],
  "How Long Will It Last?",
);
assert.equal(labels["org.opencontainers.image.licenses"], "MIT");
assert.equal(
  labels["org.opencontainers.image.version"],
  JSON.parse(readFileSync("package.json", "utf8")).version,
);
assert.equal(
  labels["org.opencontainers.image.revision"],
  process.env.GITHUB_SHA,
);
assert.ok(
  Number.isFinite(Date.parse(labels["org.opencontainers.image.created"])),
);

const base = "http://127.0.0.1:3200";
async function waitReady() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      if (
        (await fetch(base + "/healthz", { signal: AbortSignal.timeout(2000) }))
          .ok
      )
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Container did not become ready");
}
async function request(path, method = "GET", payload, user = "ci-user") {
  return fetch(base + path, {
    method,
    headers: {
      "X-Forwarded-User": user,
      "X-Requested-With": "howlongwillitlast",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}
await waitReady();
assert.equal((await fetch(base + "/api/boards")).status, 401);
assert.equal((await request("/")).status, 200);
const created = await request("/api/boards", "POST", {
  name: "Persisted board",
  unit: "cm",
  selectedModels: ["linear-all"],
});
assert.equal(created.status, 201);
const board = await created.json();
assert.equal(
  (
    await request("/api/boards/" + board.id + "/measurements", "POST", {
      measuredAt: 1000,
      value: 100,
    })
  ).status,
  201,
);
execFileSync("docker", ["restart", "howlong-ci"]);
await waitReady();
const snapshot = await (await request("/api/boards/" + board.id)).json();
assert.equal(snapshot.measurements.length, 1);
assert.equal(snapshot.measurements[0].value, 100);
assert.equal(
  (await request("/api/boards/" + board.id, "GET", undefined, "other-user"))
    .status,
  404,
);
console.log(
  "Production image: authentication, static UI, restart persistence and ownership verified.",
);
