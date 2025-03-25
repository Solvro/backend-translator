import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "languages";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string("iso_code", 2).primary(); // ISO 639-1

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
