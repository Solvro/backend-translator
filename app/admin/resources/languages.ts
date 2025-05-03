import { LucidResource } from "@adminjs/adonis";
import { ActionRequest } from "adminjs";

import Language from "#models/language";

import { readOnlyTimestamps } from "./utils/timestamps.js";

interface LanguagePayload {
  isoCode?: string;
}

export const LanguageResource = {
  resource: new LucidResource(Language, "postgres"),
  options: {
    properties: {
      ...readOnlyTimestamps,
      isoCode: {
        isTitle: true,
        type: "string",
        description: "ISO 639-1 two-letter language code (e.g., en, fr, de)",
        isVisible: {
          list: true,
          filter: true,
          show: true,
          edit: true,
          new: true,
        },
      },
    },
    actions: {
      new: {
        before: async (request: ActionRequest) => {
          const payload = request.payload as LanguagePayload;
          if (typeof payload.isoCode === "string") {
            payload.isoCode = payload.isoCode.toLowerCase();
          }
          return request;
        },
      },
      edit: {
        before: async (request: ActionRequest) => {
          const payload = request.payload as LanguagePayload;
          if (typeof payload.isoCode === "string") {
            payload.isoCode = payload.isoCode.toLowerCase();
          }
          return request;
        },
      },
    },
  },
};
