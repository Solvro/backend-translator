import { DateTime } from "luxon";

import { BaseModel, belongsTo, column } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import Language from "#models/language";

export default class Translation extends BaseModel {
  @column({ isPrimary: true })
  declare hash: string;

  @column()
  declare originalText: string;

  @column()
  declare translatedText: string;

  @column()
  declare originalLanguageCode: string;

  @belongsTo(() => Language)
  declare originalLanguage: BelongsTo<typeof Language>;

  @column()
  declare translatedLanguageCode: string;

  @belongsTo(() => Language)
  declare translatedLanguage: BelongsTo<typeof Language>;

  @column()
  declare isApproved: boolean;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
