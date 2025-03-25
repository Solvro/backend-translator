import vine from "@vinejs/vine";

/*
 * Validates the language's create action
 */
export const createLanguageValidator = vine.compile(
  vine.object({
    isoCode: vine.string().fixedLength(2).trim().toLowerCase(),
  }),
);

/*
 * Validates the language's update action
 */
export const updateLanguageValidator = vine.compile(
  vine.object({
    isoCode: vine.string().fixedLength(2).trim().toLowerCase(),
  }),
);
