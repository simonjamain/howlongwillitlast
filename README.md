# How Long Will It Last?

A mobile-first, self-hosted app to record measurements of depleting resources and estimate when they will run out.

> Contract review stage — TypeScript ports only; no runnable application or production-ready release.

## Project decisions and AI continuation

Read [AGENTS.md](AGENTS.md) for the agent entry point and [docs/HANDOFF.md](docs/HANDOFF.md) for the complete product decisions, architecture, open questions and next steps. The handoff distinguishes decisions confirmed in conversation from inherited choices and technical recommendations.

The owner has authorized ports and supporting types for review before implementation. Read [docs/PORTS.md](docs/PORTS.md) for the proposed contracts and validation. Adapters, use cases, forecasting algorithms and UI remain unimplemented.

## Planned features

- Independent per-user measurement boards with a freely chosen unit
- Irregularly spaced measurements with editable date and time, defaulting to now
- Backdated entries, corrections and individual deletion
- Multiple forecasts selected per board and displayed as separate colored lines
- Initial models: linear regression on all measurements and on the five most recent measurements
- The selection window belongs to each model proposal
- Days remaining and estimated depletion date for each model when a future zero crossing can be predicted
- Reset a board by deleting its measurements after replenishment
- French and English interface selected from browser preferences
- SQLite persistence on a persistent volume; single-container Docker deployment

## Security model

Production deployments **must** place the app behind a trusted authenticating reverse proxy such as OAuth2 Proxy, prevent direct access to the application port, and remove any incoming identity headers before the proxy sets its own. The application enforces ownership on every board and measurement operation.

Development-only authentication bypass will be opt-in and map all requests to a single fixed test user. It must remain disabled in production. Exact identity headers and stable user identifier remain to be specified. See [SECURITY.md](SECURITY.md).

## Technology and architecture

Vue 3, TypeScript, Vite, PrimeVue, Apache ECharts, Node.js, Fastify, Drizzle ORM and SQLite.

Use a lightweight hexagonal architecture: domain rules and forecasting calculations remain independent of frameworks; ports and adapters connect persistence, HTTP and proxy-provided identity. Keep code and operations simple.

## Status

Product framing and continuation documentation are available. Installation, deployment instructions and API details will be added with verified implementation.

## License

MIT. See [LICENSE](LICENSE).
