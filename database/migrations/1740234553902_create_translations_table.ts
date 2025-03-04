import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "translations";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string("hash"); //hashed original text

      table.text("original_text").notNullable();
      table.text("translated_text").notNullable();

      table
        .string("original_language_code")
        .references("languages.iso_code")
        .onDelete("RESTRICT")
        .onUpdate("CASCADE")
        .notNullable();
      table
        .string("translated_language_code")
        .references("languages.iso_code")
        .onDelete("RESTRICT")
        .onUpdate("CASCADE")
        .notNullable();

      table.boolean("is_approved").defaultTo(false);

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.primary(["hash", "translated_language_code"]);
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
