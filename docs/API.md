# HTTP API

Except `GET /healthz`, routes require trusted proxy identity. JSON failures: `error.code` is `not-found` (404), `invalid-input` (400), `unauthenticated` (401) or a sanitized `internal-error` (500). An absent and a non-owned resource both return 404.

Send `X-Requested-With: howlongwillitlast` for every non-GET mutation, including forecast POST. This is a browser CSRF defense: a cross-origin request needs preflight and this app grants no CORS permissions. The header is not a credential. Send JSON bodies as `application/json`. Unknown fields and wrong types are rejected rather than coerced.

| Method | Route | Body / result |
| --- | --- | --- |
| GET | `/healthz` | Public process liveness: `{ "status": "ok" }` |
| GET | `/api/boards` | Array of owned boards |
| POST | `/api/boards` | Board settings → board, 201 |
| GET | `/api/boards/:id` | `{ board, measurements }`, readings sorted by date then id |
| PUT | `/api/boards/:id` | Full replacement of editable settings → board |
| POST | `/api/boards/:id/measurements` | Measurement input → reading, 201 |
| PUT | `/api/boards/:id/measurements/:measurementId` | Measurement input → reading |
| DELETE | `/api/boards/:id/measurements/:measurementId` | Delete reading, 204 |
| DELETE | `/api/boards/:id/measurements` | Reset readings, keep settings, 204; succeeds for an already empty owned board |
| POST | `/api/boards/:id/forecast` | `{ asOf, sampleAt }` → forecasts in selected model order |

Settings: `{ "name": "Fuel", "unit": "cm", "selectedModels": ["linear-all", "linear-last-five"] }`. Name: trimmed, nonempty, max 120 characters. Unit: may be empty, max 40 characters. Select zero, one or two distinct models. IDs are server-generated opaque strings. Owner IDs cannot be supplied in bodies.

Measurement: `{ "measuredAt": 1792886400000, "value": 75.5 }`. Instants are integer UTC Unix milliseconds within ±8.64e15. Values are finite, bounded to ±1e12. Negative/increasing readings and duplicate dates are accepted. No automatic replenishment/reset inference occurs.

Forecast request: `asOf` is normally now. `sampleAt` has at most 1000 plotting instants; an empty array is valid. Each model applies its own selection window. The recent model takes up to five rows by measured time, then id for ties; it needs two distinct dates in that window.

A forecast is `insufficient-data`, or `available` with `usedMeasurementIds`, `points: [{ at, value }]` and `depletion`. Depletion is `future` with `at` and `remainingMs`, `already-depleted` with `at`, or `not-predicted`. Non-decreasing trends or an unrepresentable depletion date produce `not-predicted`. Curves are not clamped to zero. Duration is relative to `asOf`.

The UI rounds remaining days up, shows a configurable chart horizon independent of the depletion calculation, and refreshes estimates after edits, on window focus or on request. It displays the calculation time.
