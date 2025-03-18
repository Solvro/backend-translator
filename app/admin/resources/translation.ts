import { LucidResource } from "@adminjs/adonis";

import Translation from "#models/translation";

import { readOnlyTimestamps } from "./utils/timestamp.js";

export const translationResource = {
  resource: new LucidResource(Translation, "postgres"),
  options: {
    properties: {
      hash: {
        isVisible: {
          edit: false,
          show: false,
          list: false,
          filter: false,
        },
        edit: {
          isAccessible: false,
          isVisible: false,
        },
      },
      originalText: {
        type: "richtext",
      },
      translatedText: {
        type: "richtext",
      },
      ...readOnlyTimestamps,
    },
  },
};
