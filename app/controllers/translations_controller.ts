import { RequestBundler } from "@solvro/utils/request_bundler";
import { createHash } from "node:crypto";
import OpenAI from "openai";

import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import Translation from "#models/translation";
import UrlTranslation from "#models/url_translation";
import env from "#start/env";
import {
  createTranslationValidator,
  openaiTranslationValidator,
  updateTranslationValidator,
} from "#validators/translation";

const openai = new OpenAI({
  apiKey: env.get("OPENAI_API_KEY"),
});

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
   * Perform the actual translation using OpenAI
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
    2. Maintain the original tone, style, and intent of the text
    3. Keep technical terms, proper nouns, and domain-specific vocabulary intact
    4. Ensure natural-sounding translations in the target language
    5. Do not add any explanatory text or comments
    6. Do not add any additional information
    7. If the text contains no alphanumeric characters, return it unchanged
    8. For ambiguous terms, choose the most contextually appropriate translation
    9. Never return anything else than the translated text. Phrases like "Translation:", "Translated text:" or "No text to translate" are not allowed.
    10. Do not trim extra spaces or newlines.
    11. If the original text is already in the target language, return it unchanged.
    12. Do not translate URLs, email addresses, phone numbers, or other non-text content e.g. "https://www.google.com", "solvro.pwr.edu.pl" or "john.doe@example.com" or "+48 123 456 789"
    13. Do not translate addresses / street names. Also try to not translate bus stops, train stations, etc.

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
    let translatedText: string | undefined;
    let counter = 0;
    logger.info(`Starting translation.`);

    for (const textChunk of textChunks) {
      const aiParams: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: textChunk },
        ],
        model: "gpt-4o",
        store: true,
      };

      const completion = await openai.chat.completions.create(aiParams);
      const content = completion.choices[0]?.message?.content ?? "";
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
}
