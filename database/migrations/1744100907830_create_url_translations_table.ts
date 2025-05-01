import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "url_translations";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id").notNullable();
      table.string("source_url").notNullable();
      table.string("target_url").notNullable();
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
      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").nullable();
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
