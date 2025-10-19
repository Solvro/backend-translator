import vine from "@vinejs/vine";

/*
 * Validates the translation's create action
 */
export const createTranslationValidator = vine.compile(
  vine.object({
    originalText: vine.string().minLength(1).trim(),
    translatedText: vine.string().minLength(1).trim(),
    originalLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
    translatedLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
  }),
);

/*
 * Validates the translation's update action
 */
export const updateTranslationValidator = vine.compile(
  vine.object({
    originalText: vine.string().minLength(1).trim(),
    translatedText: vine.string().minLength(1).trim(),
    originalLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
    translatedLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
  }),
);

/*
 * Validates the translation's openai action
 */
export const openaiTranslationValidator = vine.compile(
  vine.object({
    originalText: vine.string().minLength(1).trim(),
    originalLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
    translatedLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
  }),
);

/*
 * Validates the batch translation request
 */
export const batchTranslationValidator = vine.compile(
  vine.object({
    texts: vine.array(vine.string().minLength(1).trim()).minLength(1),
    originalLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
    translatedLanguageCode: vine.string().fixedLength(2).trim().toLowerCase(),
  }),
);
