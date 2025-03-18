import { LucidResource } from "@adminjs/adonis";

import Language from "#models/language";

import { readOnlyTimestamps } from "./utils/timestamp.js";

export const languageResource = {
  resource: new LucidResource(Language, "postgres"),
  options: {
    properties: {
      isoCode: {
        type: "string",
        isVisible: {
          edit: true,
          show: true,
          list: true,
          filter: true,
        },
      },
      ...readOnlyTimestamps,
    },
    actions: {
      edit: {
        isAccessible: false,
        isVisible: false,
      },
    },
  },
};
