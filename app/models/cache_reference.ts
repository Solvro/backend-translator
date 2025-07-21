import { DateTime } from "luxon";

import { BaseModel, column } from "@adonisjs/lucid/orm";

export default class CacheReference extends BaseModel {
  static table = "cache_reference_number";

  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare referenceNumber: number;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;

  public static async bumpCache() {
    await CacheReference.query().increment("reference_number", 1);
  }
}
