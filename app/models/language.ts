import { DateTime } from "luxon";

import { BaseModel, column, hasMany } from "@adonisjs/lucid/orm";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import Translation from "#models/translation";

export default class Language extends BaseModel {
  @column({ isPrimary: true })
  declare isoCode: string; // ISO 639-1

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;

  @hasMany(() => Translation)
  declare translations: HasMany<typeof Translation>;
}
