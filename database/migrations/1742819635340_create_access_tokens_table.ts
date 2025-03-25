import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "api_tokens";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.string("name").notNullable();
      table.string("hash").notNullable();
      table.timestamp("created_at");
      table.timestamp("updated_at");
      table.timestamp("last_used_at").nullable();
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
