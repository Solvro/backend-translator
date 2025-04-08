import { LucidResource } from "@adminjs/adonis";

import Language from "#models/language";

import { readOnlyTimestamps } from "./utils/timestamps.js";

export const LanguageResource = {
  resource: new LucidResource(Language, "postgres"),
  options: {
    properties: {
      ...readOnlyTimestamps,
    },
  },
};
