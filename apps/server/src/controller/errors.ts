import type { FastifyReply } from "fastify";
import { isForgeError } from "@frontend-forge/forge-core";
import { isCodeExporterError } from "@frontend-forge/forge-core/advanced";

export function handleKnownError(err: unknown, reply: FastifyReply) {
  if (isForgeError(err)) {
    reply.code(err.statusCode);
    reply.log.warn(
      { statusCode: err.statusCode, err },
      "Request failed (ForgeError)",
    );
    return {
      ok: false,
      error: err.message || String(err),
      message: err.message || String(err),
    };
  }
  if (isCodeExporterError(err)) {
    reply.code(err.statusCode);
    reply.log.warn(
      { statusCode: err.statusCode, err },
      "Request failed (CodeExporterError)",
    );
    return {
      ok: false,
      error: err.message || String(err),
      message: err.message || String(err),
    };
  }
  throw err;
}
