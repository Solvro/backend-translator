import crypto from "node:crypto";

import { BaseCommand, args } from "@adonisjs/core/ace";
import type { CommandOptions } from "@adonisjs/core/types/ace";

import ApiToken from "#models/api_token";

export default class GenerateToken extends BaseCommand {
  static commandName = "generate:token";
  static description = "Generate a new API token";

  static options: CommandOptions = {
    startApp: true,
  };

  @args.string({
    argumentName: "name",
    description: "Name of the API token",
  })
  declare name: string;

  async run() {
    const plainToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(plainToken)
      .digest("hex");

    await ApiToken.create({ name: this.name, hash: hashedToken });
    this.logger.info(`Generated Token: ${plainToken}`);
    this.logger.info(
      "Store this token safely. You won't be able to see it again.",
    );
  }
}
