import { RequestBundler } from "@solvro/utils/request_bundler";
import { createHash } from "node:crypto";

import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import Translation from "#models/translation";
import UrlTranslation from "#models/url_translation";
import {
  completeChat,
  getTranslationBackend,
  mapWithConcurrency,
} from "#services/translation_backend";
import {
  batchTranslationValidator,
  createTranslationValidator,
  openaiTranslationValidator,
  updateTranslationValidator,
} from "#validators/translation";

export default class TranslationsController {
  // Lock mechanism to prevent race conditions on translation requests
  private static translationRequestBundler = new RequestBundler<
    string,
    Translation
  >();

  /**
   * Display a list of resource
   */
  async index() {
    return await Translation.all();
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createTranslationValidator);

    const hash = createHash("sha256").update(data.originalText).digest("hex");
    const existingTranslation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", data.translatedLanguageCode)
      .first();
    if (existingTranslation !== null) {
      return response.conflict({ message: "Translation already exists." });
    }

    const translation = await Translation.create({
      hash,
      ...data,
      isApproved: false,
    });
    return response.created(translation);
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const { hash, isoCode } = params as { hash: string; isoCode: string };
    return await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", isoCode)
      .firstOrFail();
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const { hash, isoCode } = params as { hash: string; isoCode: string };
    const data = await request.validateUsing(updateTranslationValidator);

    const translation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", isoCode)
      .firstOrFail();

    const newHash = createHash("sha256")
      .update(data.originalText)
      .digest("hex");
    const existingTranslation = await Translation.find(newHash);
    if (existingTranslation !== null) {
      return existingTranslation;
    }

    translation.merge({
      hash: newHash,
      ...data,
      isApproved: false,
    });
    await translation.save();
    return translation;
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const { hash, isoCode } = params as { hash: string; isoCode: string };
    const translation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", isoCode)
      .firstOrFail();
    await translation.delete();
  }

  /**
   * Approve translation
   */
  async approve({ params }: HttpContext) {
    const { hash, isoCode } = params as { hash: string; isoCode: string };
    const translation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", isoCode)
      .firstOrFail();
    translation.isApproved = true;
    await translation.save();
    return translation;
  }

  /**
   * Split text into chunks that won't exceed token limits
   */
  private *splitTextIntoChunks(text: string, maxChunkLength = 15000) {
    // Split by sentences to avoid breaking mid-sentence
    const sentences = text.match(/[^.!?]+[.!?]+\s*|[^.!?\s]+(?:\s+|$)/g) ?? [
      text,
    ];
    let currentChunk = "";
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkLength) {
        if (currentChunk) {
          yield currentChunk;
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      yield currentChunk;
    }
  }

  private async replaceTranslatedUrls(
    translation: Translation,
  ): Promise<Translation> {
    // Get URL translations for the specific language pair
    const urlTranslations = await UrlTranslation.query()
      .where("original_language_code", translation.originalLanguageCode)
      .where("translated_language_code", translation.translatedLanguageCode);

    const sorted = urlTranslations.sort((a, b) => {
      return b.sourceUrl.length - a.sourceUrl.length;
    });

    const matchedURLs: string[] = [];

    // Replace URLs with their translated versions
    for (const urlTranslation of sorted) {
      if (translation.translatedText.includes(urlTranslation.sourceUrl)) {
        if (
          matchedURLs.some((matchedURL) =>
            matchedURL.startsWith(urlTranslation.sourceUrl),
          )
        ) {
          continue;
        }
        matchedURLs.push(urlTranslation.sourceUrl);
        translation.translatedText = translation.translatedText.replaceAll(
          urlTranslation.sourceUrl,
          urlTranslation.targetUrl,
        );
      }
    }
    return translation;
  }

  /**
   * Request translation by OpenAI
   */
  async requestTranslationOpenAI({ request }: HttpContext) {
    const { originalText, originalLanguageCode, translatedLanguageCode } =
      await openaiTranslationValidator.validate(request.all());

    const hash = createHash("sha256").update(originalText).digest("hex");
    const lockKey = `${hash}-${translatedLanguageCode}`;

    return TranslationsController.translationRequestBundler.run(
      lockKey,
      async () => {
        // Check if translation already exists in the database
        const existingTranslation = await Translation.query()
          .where("hash", hash)
          .where("translatedLanguageCode", translatedLanguageCode)
          .first();

        if (existingTranslation !== null) {
          return await this.replaceTranslatedUrls(existingTranslation);
        }

        const translation = await this.performTranslation(
          hash,
          originalText,
          originalLanguageCode,
          translatedLanguageCode,
        );
        return await this.replaceTranslatedUrls(translation);
      },
    );
  }

  /**
   * Perform the actual translation using the configured backend
   */
  private async performTranslation(
    hash: string,
    originalText: string,
    originalLanguageCode: string,
    translatedLanguageCode: string,
  ): Promise<Translation> {
    const systemPrompt = `
    You are a professional translation tool. Your task is to translate text from ${originalLanguageCode} to ${translatedLanguageCode} while maintaining the highest quality and accuracy.  The languages were defined as ISO 639-1 codes
    Key requirements:
    1. Preserve all original formatting, including line breaks, spacing, and special characters
    2. Preserve ALL HTML tags (e.g., <p>, <br>, <strong>, <em>, <a>, <div>, <span>, etc.) exactly as they appear in the original text - do not modify, remove, or add any HTML tags
    3. Maintain the original tone, style, and intent of the text
    4. Keep technical terms, proper nouns, and domain-specific vocabulary intact
    5. Ensure natural-sounding translations in the target language
    6. Do not add any explanatory text or comments
    7. Do not add any additional information
    8. If the text contains no alphanumeric characters, return it unchanged
    9. For ambiguous terms, choose the most contextually appropriate translation
    10. Never return anything else than the translated text. Phrases like "Translation:", "Translated text:" or "No text to translate" are not allowed.
    11. Do not trim extra spaces or newlines.
    12. If the original text is already in the target language, return it unchanged.
    13. Do not translate URLs, email addresses, phone numbers, or other non-text content e.g. "https://www.google.com", "solvro.pwr.edu.pl" or "john.doe@example.com" or "+48 123 456 789"
    14. Do not translate addresses / street names. Also try to not translate bus stops, train stations, etc.

    ${
      originalLanguageCode === "pl" && translatedLanguageCode === "en"
        ? `
    Preferred translations for Polish to English:
     - "Koło naukowe" -> "Science Club"
     - "PWr" -> "Wrocław Tech"
     - "Samorząd studentów" (or similar) -> "Student Council"


     Do not translate the following proper nouns:
     - "ToPWR" (name of a cool mobile app)
     - "KN Solvro" (name of the best science club)
     `
        : ""
    }
    `.trim();

    const textChunks = this.splitTextIntoChunks(originalText);
    const backend = getTranslationBackend();
    let translatedText: string | undefined;
    let counter = 0;
    logger.info(`Starting translation with ${backend.model}.`);

    for (const textChunk of textChunks) {
      const content = await completeChat(backend, systemPrompt, textChunk);
      if (translatedText === undefined) {
        translatedText = content;
      } else {
        translatedText += content;
      }
      logger.info(`Translated chunk no: ${counter}.`);
      counter++;
    }

    if (translatedText === undefined) {
      throw new Error("Translation failed: no text returned");
    }

    logger.info(`Translated text in ${counter} chunks.`);

    const translation = await Translation.create({
      hash,
      originalText,
      translatedText,
      originalLanguageCode,
      translatedLanguageCode,
      isApproved: false,
    });

    return translation;
  }

  /**
   * All translations for a specific language
   */
  async translationsForLanguage({ params }: HttpContext) {
    const { isoCode } = params as { isoCode: string };
    return Translation.query().where("translatedLanguageCode", isoCode);
  }

  /**
   * All translations for a specific text
   */
  async translationsForText({ params }: HttpContext) {
    const { hash } = params as { hash: string };
    return Translation.query().where("hash", hash);
  }

  /**
   * Request batch translation by OpenAI
   */
  async requestBatchTranslation({ request, response }: HttpContext) {
    const { texts, originalLanguageCode, translatedLanguageCode } =
      await batchTranslationValidator.validate(request.all());

    const results = await mapWithConcurrency(
      texts,
      getTranslationBackend().concurrency,
      async (originalText) => {
        const hash = createHash("sha256").update(originalText).digest("hex");
        const lockKey = `${hash}-${translatedLanguageCode}`;

        try {
          const translationResult =
            await TranslationsController.translationRequestBundler.run(
              lockKey,
              async () => {
                // Check if translation already exists in the database
                const existingTranslation = await Translation.query()
                  .where("hash", hash)
                  .where("translatedLanguageCode", translatedLanguageCode)
                  .first();

                if (existingTranslation !== null) {
                  return await this.replaceTranslatedUrls(existingTranslation);
                }

                const newTranslation = await this.performTranslation(
                  hash,
                  originalText,
                  originalLanguageCode,
                  translatedLanguageCode,
                );
                return await this.replaceTranslatedUrls(newTranslation);
              },
            );

          return {
            originalText,
            translation: translationResult,
            success: true,
          };
        } catch (error) {
          logger.error(
            `Failed to translate text: ${originalText}`,
            error as Error,
          );
          return {
            originalText,
            translation: null,
            success: false,
            error: (error as Error).message,
          };
        }
      },
    );

    return response.ok({
      translations: results,
      total: texts.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  }
}
