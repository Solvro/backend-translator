import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "translations";

  public async up() {
    const streetElements = [
      "St.",
      "st.",
      "Street",
      "street",
      "St",
      "st",
      "Ave",
      "ave",
      "En.",
      "en.",
      "Street",
      "street",
      "Av.",
      "av.",
      "Wyb.",
      "wyb.",
      "St.",
      "st.",
      "Square",
      "square",
      "Ul.",
      "ul.",
      "Pl.",
      "pl.",
    ];

    for (const element of streetElements) {
      await this.db
        .from(this.tableName)
        .where("original_text", "like", `% ${element} %`)
        .orWhere("translated_text", "like", `% ${element} %`)
        .delete();
    }
  }

  public async down() {
    // This operation cannot be reversed as it deletes data
    console.warn("This migration cannot be reversed");
  }
}
