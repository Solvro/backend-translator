import { LucidResource } from "@adminjs/adonis";

import Translation from "#models/translation";

import { Components } from "../component_loader.js";
import { readOnlyTimestamps } from "./utils/timestamps.js";

export const TranslationResource = {
  resource: new LucidResource(Translation, "postgres"),
  options: {
    properties: {
      ...readOnlyTimestamps,
      hash: {
        isVisible: {
          list: false,
          edit: false,
          filter: false,
          show: true,
        },
      },
      originalText: {
        components: {
          list: Components.TruncatedText,
        },
      },
      translatedText: {
        components: {
          list: Components.TruncatedText,
        },
      },
    },
  },
  features: [],
};
