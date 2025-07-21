import { BaseSeeder } from "@adonisjs/lucid/seeders";

import CacheReference from "#models/cache_reference";

export default class extends BaseSeeder {
  async run() {
    await CacheReference.create({
      referenceNumber: 1,
    });
  }
}
