import { LucidResource } from "@adminjs/adonis";

import UrlTranslation from "#models/url_translation";

import { readOnlyTimestamps } from "./utils/timestamps.js";

export const UrlTranslationResource = {
  resource: new LucidResource(UrlTranslation, "postgres"),
  options: {
    properties: {
      ...readOnlyTimestamps,
      sourceUrl: {
        isTitle: true,
      },
      targetUrl: {
        isTitle: true,
      },
      originalLanguageCode: {
        reference: "languages",
      },
      translatedLanguageCode: {
        reference: "languages",
      },
    },
  },
};
