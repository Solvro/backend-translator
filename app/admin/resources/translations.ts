import { LucidResource } from "@adminjs/adonis";

import Translation from "#models/translation";

import { readOnlyTimestamps } from "./utils/timestamps.js";

export const TranslationResource = {
  resource: new LucidResource(Translation, "postgres"),
  options: {
    properties: {
      ...readOnlyTimestamps,
    },
  },
};
