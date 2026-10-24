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

After the image is published from main, copy `.env.example` to `.env`, fill your OIDC settings, and generate a cookie secret locally:

```sh
cp .env.example .env
openssl rand -base64 32 | tr -- '+/' '-_'
# Put the generated value in OAUTH2_PROXY_COOKIE_SECRET in .env.
docker compose -f compose.production.example.yaml up -d
```

The stack includes OAuth2 Proxy v7.15.5 and the application. The only external component is your HTTPS reverse proxy (for example Traefik). Connect it to `PROXY_NETWORK` and forward the entire site root, including `/oauth2/`, to **`http://oauth2-proxy:4180`**. Do not forward to the app.

OAuth2 Proxy authenticates through the generic OIDC provider, removes incoming authentication headers and supplies `X-Forwarded-User` to `http://app:3000/`. The app is connected only to a separate internal backend network, with no published port. OAuth2 Proxy alone joins both networks. Its `depends_on` waits for the app health check.

Register **`APP_URL/oauth2/callback`** as the exact redirect URI in your confidential OIDC client, replacing APP_URL with the public HTTPS URL. Configure the client for authorization code with PKCE S256 and scopes `openid profile email`; the provider must supply a verified email. Adapt provider-specific settings if required by your IdP.

| Setting | Purpose |
| --- | --- |
| `APP_URL` | Public HTTPS URL, without trailing slash |
| `OIDC_ISSUER_URL` | Exact issuer URL, reachable from OAuth2 Proxy |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Confidential OIDC client credentials |
| `OAUTH2_PROXY_COOKIE_SECRET` | Random 32-byte secret generated above |
| `OIDC_EMAIL_DOMAINS` | Allowed email domain(s), comma-separated; use your actual policy |
| `PROXY_NETWORK` | Existing HTTPS reverse-proxy network, default `proxy` |
| `IMAGE_TAG` | App image tag, default `latest` |

Do not commit `.env`. Secure cookies require HTTPS. The HTTPS proxy must sanitize forwarding headers and be the only path to OAuth2 Proxy. Restrict membership of its network. No bypass route, insecure certificate option, Redis or separate app login is enabled.

`X-Forwarded-User` uses the OIDC user identity rather than preferring email. Keep the issuer/client/subject mapping stable: changing identity mapping changes which boards users see. The app still accepts another trusted header through `IDENTITY_HEADER` for custom deployments; the supplied stack fixes the header to match OAuth2 Proxy.

For the app itself: `AUTH_MODE=proxy` and `NODE_ENV=production` in production; `AUTH_MODE=development` and `NODE_ENV=development` in the root development Compose. Other app settings are `DATABASE_PATH` (Docker `/data/app.sqlite`), `HOST` (Docker `0.0.0.0`) and `PORT` (3000). The development stack requires no OIDC configuration.

CI validates Compose interpolation and OAuth2 Proxy configuration with dummy credentials and discovery disabled for that check only. This does not verify a login against your real IdP; discovery and certificate verification remain enabled in the production example.

References: [OAuth2 Proxy configuration](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/) and [releases](https://github.com/oauth2-proxy/oauth2-proxy/releases).

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
