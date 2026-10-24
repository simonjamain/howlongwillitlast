# How Long Will It Last?

A mobile-first, self-hosted app to record reserves and estimate when they run out. Fuel, firewood, a balance: create a board with a name and any unit.

## Features

- Personal boards with editable settings and selected forecasting models.
- Irregular measurements with editable date/time defaulting to now; backdating, correction and deletion.
- Linear regression on all readings or up to the five most recent ones, available from two distinct measurement times.
- Colored forecasts, estimated days remaining and depletion date; explicit insufficient-data, non-decreasing-trend and past-depletion states.
- Confirmed reset deletes readings while retaining board settings.
- French and English, initially selected from browser preferences, switchable in the header.
- SQLite on a persistent volume; one container serves both API and compiled frontend.

These are estimates, not guarantees. Units are used as entered; tank height is not converted to volume. Consumption changes and tank geometry can make a linear forecast misleading.

## Local start — Node.js 24

```sh
npm ci
npm run build
AUTH_MODE=development npm start
```

Open http://127.0.0.1:3000. Explicit development mode uses the fixed identity `development-user` and ignores identity headers. It refuses to start with `NODE_ENV=production`; keep it local.

For hot reload, run `AUTH_MODE=development npm run dev` and `npm run dev:ui` in separate terminals. Open the Vite address; its `/api` proxy targets port 3000. The server does not automatically load `.env`; export shell variables.

## Docker development — no setup

```sh
docker compose up --build
```

Open http://127.0.0.1:3000. The root Compose file enables development identity explicitly, stores readings in its own named volume, and requires neither a proxy nor an external network nor an environment file. It runs the compiled app; rebuild after source changes, or use the hot-reload commands above. Port 3000 is bound to localhost.

## Production deployment example

After the image has been published from main, adapt `compose.production.example.yaml` to your proxy's existing network:

```sh
PROXY_NETWORK=proxy docker compose -f compose.production.example.yaml up -d
```

This example uses the GHCR image (`IMAGE_TAG=latest` by default), authenticates via proxy headers, and publishes no host port. Forward to `http://app:3000` on the proxy network, at the site root. Its database volume is separate from development. The authentication proxy itself is configured on your infrastructure.

The proxy must authenticate requests, strip incoming client identity headers, then set its own. Block direct access and restrict membership of the network. Use HTTPS and serve UI/API on the same origin. The app trusts the proxy; it does not validate tokens or consult the IdP.

The default identity header is `X-Forwarded-User`. Configure `IDENTITY_HEADER` if your proxy forwards another header, such as `X-Auth-Request-User` in a forward-auth chain. Choose an identity stable over time and unique within the authentication realm. Changing that mapping changes board ownership as seen by users. See [SECURITY.md](SECURITY.md).

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_MODE` | `proxy` | `proxy` or explicit local `development` |
| `IDENTITY_HEADER` | `x-forwarded-user` | Header set by trusted proxy |
| `DATABASE_PATH` | `data/app.sqlite` locally, `/data/app.sqlite` in Docker | SQLite file |
| `HOST` | `127.0.0.1` locally, `0.0.0.0` in Docker | Listener |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | unset locally, `production` in Docker | Blocks development auth in production |
| `PROXY_NETWORK` | `proxy` | Production example network name |
| `IMAGE_TAG` | `latest` | Production example GHCR image tag |

The image runs as non-root user `node` (UID 1000). The named volume is initialized with the image's directory permissions; for bind mounts, make the directory writable by UID 1000. Back up SQLite with its backup API, or stop the app before copying database/WAL files. Keep backups outside this repository.

## GitHub Container Registry

[GitHub Actions](https://github.com/simonjamain/howlongwillitlast/actions) builds and tests the app, runs browser tests on desktop/mobile, then builds and exercises the production container, including restart persistence. Successful **pushes to main** publish the tested image to `ghcr.io/simonjamain/howlongwillitlast` using `GITHUB_TOKEN` and job-level `packages: write`. PR builds validate without publishing.

Tags: `main`, `sha-<full commit SHA>`, and `latest`. Pull requests build/test without publishing; merging into main triggers the publication workflow.

```sh
docker pull ghcr.io/simonjamain/howlongwillitlast:latest
```

Publication is confirmed only by a successful workflow run. Repository/organization policies can restrict writes. A newly created package may be private; anonymous pulls depend on its package visibility setting. No registry credential is stored in the repo.

## OCI image metadata

The Dockerfile includes standard `org.opencontainers.image.*` labels: title, description, source, URL, documentation, MIT license, maintainer/vendor, version, revision and creation time. CI supplies the package version, exact commit and UTC RFC 3339 build time, and verifies labels on the built image. Local builds use version `dev` and leave revision/time empty unless supplied with `--build-arg IMAGE_VERSION=... --build-arg VCS_REF=... --build-arg BUILD_DATE=...`.

Reference: [OCI predefined annotation keys](https://specs.opencontainers.org/image-spec/annotations/).

## Verification

```sh
npm run build
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run format:check
```

TypeScript is pinned to 6.0.2 for compatibility with `vue-tsc`; dependencies are locked in `package-lock.json`. Browser tests can use an existing executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Design and continuation

Vue 3, TypeScript, Vite, PrimeVue 4, Apache ECharts, Node.js, Fastify, Drizzle ORM and SQLite. Domain/application rules depend on ports; HTTP/SQLite are adapters. All assets are self-hosted, including chart code.

Read [AGENTS.md](AGENTS.md), [docs/HANDOFF.md](docs/HANDOFF.md), [docs/PORTS.md](docs/PORTS.md) and [docs/API.md](docs/API.md).

MIT. See [LICENSE](LICENSE).
