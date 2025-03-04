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
