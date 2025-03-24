import { DateTime } from "luxon";
import crypto from "node:crypto";

import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import ApiToken from "#models/api_token";

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated requests.
 */
export default class AuthMiddleware {
  public async handle(
    { request, response }: HttpContext,
    next: () => Promise<void>,
  ) {
    if (request.method() === "GET") {
      await next();
      return;
    }

    const token = request.header("x-api-token");

    if (token === undefined) {
      logger.error("missing token");
      return response.unauthorized({ error: "Missing API token" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const authToken = await ApiToken.query().where("hash", hashedToken).first();

    if (authToken === null) {
      logger.error("invalid token");
      return response.unauthorized({ error: "Invalid API token" });
    }

    authToken.lastUsedAt = DateTime.now();
    await authToken.save();

    await next();
  }
}
