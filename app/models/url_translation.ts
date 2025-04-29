import { DateTime } from "luxon";

import { BaseModel, belongsTo, column } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import Language from "#models/language";

export default class UrlTranslation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare sourceUrl: string;

  @column()
  declare targetUrl: string;

  @column()
  declare originalLanguageCode: string;

  @belongsTo(() => Language)
  declare originalLanguage: BelongsTo<typeof Language>;

  @column()
  declare translatedLanguageCode: string;

  @belongsTo(() => Language)
  declare translatedLanguage: BelongsTo<typeof Language>;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null;
}
