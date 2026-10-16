import { BaseSchema } from "@adonisjs/lucid/schema";

// Commit af6c478 ("feat: implement translation backend selection") switched
// translations to NVIDIA Nemotron; everything before it came from gpt-4o-mini
const BACKEND_SELECTION_COMMITTED_AT = "2026-09-29T16:01:20+02:00";

export default class extends BaseSchema {
  protected tableName = "translations";

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Null for translations created by hand, not by a model
      table.string("model").nullable();
    });

    this.defer(async (db) => {
      await db
        .from(this.tableName)
        .whereRaw("created_at < ?::timestamptz", [
          BACKEND_SELECTION_COMMITTED_AT,
        ])
        .update({ model: "gpt-4o-mini" });
      await db
        .from(this.tableName)
        .whereRaw("created_at >= ?::timestamptz", [
          BACKEND_SELECTION_COMMITTED_AT,
        ])
        .update({ model: "nvidia/nemotron-3-super-120b-a12b" });
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("model");
    });
  }
}
