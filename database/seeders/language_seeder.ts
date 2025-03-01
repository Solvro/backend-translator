import { BaseSeeder } from "@adonisjs/lucid/seeders";

import Language from "#models/language";

export default class LanguageSeeder extends BaseSeeder {
  static environment = ["production", "development", "testing"];

  static isoCodes = ["pl", "en"];
  async run() {
    for (const code of LanguageSeeder.isoCodes) {
      await Language.updateOrCreate({ isoCode: code }, { isoCode: code });
    }
  }
}
