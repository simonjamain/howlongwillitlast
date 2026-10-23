# How Long Will It Last?

A mobile-first, self-hosted app to record measurements of depleting resources and estimate when they will run out.

> Work in progress — initial project scaffold. Not yet ready for production.

## Planned features

- Independent measurement boards (fuel level, firewood, balance, or any numeric quantity)
- Dated measurements, including backdated entries, corrections and deletion
- Multiple configurable forecasting models displayed as separate colored lines
- Days remaining and estimated depletion date for each model
- Per-user boards with identity supplied by a trusted authentication reverse proxy
- French and English interface selected from browser preferences
- SQLite persistence; single-container Docker deployment

## Security model

Production deployments **must** place the app behind a trusted authenticating reverse proxy, prevent direct access to the application port, and remove any incoming identity headers before the proxy sets its own. Development-only authentication bypass will be opt-in and map all requests to a single fixed test user.

## Technology

Vue 3, TypeScript, Vite, PrimeVue, Apache ECharts, Fastify, Drizzle ORM and SQLite.

## Status

Scaffolding in progress. Installation, deployment instructions, and API details will be added as the implementation lands.

## License

MIT. See [LICENSE](LICENSE).
