import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type FastifyError,
} from "fastify";
import staticFiles from "@fastify/static";
import type { ResourceTracking } from "../../application/ports/incoming.js";
import type {
  Actor,
  BoardSettings,
  MeasurementInput,
  Result,
} from "../../domain/types.js";

export interface HttpOptions {
  readonly authMode: "proxy" | "development";
  readonly identityHeader: string;
  readonly production: boolean;
  readonly staticRoot?: string;
  readonly logger?: boolean;
}
const settingsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "unit", "selectedModels"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    unit: { type: "string", maxLength: 40 },
    selectedModels: {
      type: "array",
      maxItems: 2,
      uniqueItems: true,
      items: { type: "string", enum: ["linear-all", "linear-last-five"] },
    },
  },
};
const instantSchema = { type: "integer", minimum: -8.64e15, maximum: 8.64e15 };
const measurementSchema = {
  type: "object",
  additionalProperties: false,
  required: ["measuredAt", "value"],
  properties: {
    measuredAt: instantSchema,
    value: { type: "number", minimum: -1e12, maximum: 1e12 },
  },
};
const forecastSchema = {
  type: "object",
  additionalProperties: false,
  required: ["asOf", "sampleAt"],
  properties: {
    asOf: instantSchema,
    sampleAt: { type: "array", maxItems: 1000, items: instantSchema },
  },
};
type BoardParams = { id: string };
type MeasurementParams = { id: string; measurementId: string };

export function createApp(service: ResourceTracking, options: HttpOptions) {
  if (options.authMode === "development" && options.production)
    throw new Error("Development authentication is forbidden in production");
  const header = options.identityHeader.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(header))
    throw new Error("Invalid identity header name");
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 128 * 1024,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  const actors = new WeakMap<FastifyRequest, Actor>();
  const actor = (req: FastifyRequest) => actors.get(req)!;
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/healthz") return;
    if (options.authMode === "development")
      actors.set(req, { userId: "development-user" });
    else {
      const value = req.headers[header];
      const raw = req.raw.rawHeaders;
      const count = raw.filter(
        (_, i) => i % 2 === 0 && raw[i]?.toLowerCase() === header,
      ).length;
      if (
        count !== 1 ||
        typeof value !== "string" ||
        !value.trim() ||
        value.length > 256 ||
        /[\r\n,]/.test(value)
      )
        return reply.code(401).send({ error: { code: "unauthenticated" } });
      actors.set(req, { userId: value.trim() });
    }
    // Cross-site forms cannot set this header; no CORS permissions are granted.
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-requested-with"] !== "howlongwillitlast"
    )
      return reply
        .code(403)
        .send({ error: { code: "request-header-required" } });
  });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler<FastifyError>((error, req, reply) => {
    if (
      error.validation ||
      (error.statusCode && error.statusCode >= 400 && error.statusCode < 500)
    ) {
      return reply
        .code(error.statusCode ?? 400)
        .send({ error: { code: "invalid-input" } });
    }
    req.log.error(error, "Request failed");
    return reply.code(500).send({ error: { code: "internal-error" } });
  });
  function send<T>(reply: FastifyReply, result: Result<T>, successCode = 200) {
    if (!result.ok)
      return reply
        .code(result.error.code === "not-found" ? 404 : 400)
        .send({ error: result.error });
    if (result.value === undefined) return reply.code(204).send();
    return reply.code(successCode).send(result.value);
  }
  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/api/boards", async (req, reply) =>
    send(reply, await service.listBoards(actor(req))),
  );
  app.post<{ Body: BoardSettings }>(
    "/api/boards",
    { schema: { body: settingsSchema } },
    async (req, reply) =>
      send(reply, await service.createBoard(actor(req), req.body), 201),
  );
  app.get<{ Params: BoardParams }>("/api/boards/:id", async (req, reply) =>
    send(reply, await service.getBoard(actor(req), req.params.id)),
  );
  app.put<{ Params: BoardParams; Body: BoardSettings }>(
    "/api/boards/:id",
    { schema: { body: settingsSchema } },
    async (req, reply) =>
      send(
        reply,
        await service.updateBoard(actor(req), req.params.id, req.body),
      ),
  );
  app.post<{ Params: BoardParams; Body: MeasurementInput }>(
    "/api/boards/:id/measurements",
    { schema: { body: measurementSchema } },
    async (req, reply) =>
      send(
        reply,
        await service.addMeasurement(actor(req), req.params.id, req.body),
        201,
      ),
  );
  app.put<{ Params: MeasurementParams; Body: MeasurementInput }>(
    "/api/boards/:id/measurements/:measurementId",
    { schema: { body: measurementSchema } },
    async (req, reply) =>
      send(
        reply,
        await service.updateMeasurement(
          actor(req),
          req.params.id,
          req.params.measurementId,
          req.body,
        ),
      ),
  );
  app.delete<{ Params: MeasurementParams }>(
    "/api/boards/:id/measurements/:measurementId",
    async (req, reply) =>
      send(
        reply,
        await service.deleteMeasurement(
          actor(req),
          req.params.id,
          req.params.measurementId,
        ),
      ),
  );
  app.delete<{ Params: BoardParams }>(
    "/api/boards/:id/measurements",
    async (req, reply) =>
      send(reply, await service.resetMeasurements(actor(req), req.params.id)),
  );
  app.post<{ Params: BoardParams; Body: { asOf: number; sampleAt: number[] } }>(
    "/api/boards/:id/forecast",
    { schema: { body: forecastSchema } },
    async (req, reply) =>
      send(reply, await service.forecast(actor(req), req.params.id, req.body)),
  );
  if (options.staticRoot)
    app.register(staticFiles, { root: options.staticRoot });
  return app;
}
