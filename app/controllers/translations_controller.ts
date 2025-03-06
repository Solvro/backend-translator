import { createHash } from "node:crypto";
import OpenAI from "openai";

import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import Translation from "#models/translation";
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
      //TODO: check if that's the way we want to handle this
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
   * Request translation by OpenAI
   */
  async requestTranslationOpenAI({ request, response }: HttpContext) {
    const { originalText, originalLanguageCode, translatedLanguageCode } =
      await openaiTranslationValidator.validate(request.all());

    const hash = createHash("sha256").update(originalText).digest("hex");
    const existingTranslation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", translatedLanguageCode)
      .first();
    if (existingTranslation !== null) {
      return existingTranslation;
    }

    //TODO: get someone from ML team to review this
    const systemPrompt = `You are a translation tool. You receive a string written in
    ${originalLanguageCode} language, and solely return the same string in ${translatedLanguageCode} language
    without losing the original formatting. Your translations are accurate, aiming not to deviate from the original
    structure, content, writing style and tone. The language were defined as ISO 639-1 codes. Do not add any additional information.`;

    const aiParams: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: originalText },
      ],
      model: "gpt-4",
      store: true,
    };

    let aiResponse;
    try {
      aiResponse = await openai.chat.completions.create(aiParams);
    } catch (error) {
      logger.error("OpenAI request failed", error);
      return response.internalServerError({
        message: "Failed to fetch translation.",
      });
    }

    const translatedText = aiResponse.choices[0].message.content?.trim();
    if (translatedText === undefined) {
      return response.internalServerError({
        message: "Translation failed.",
      });
    }

    const tokensConsumed = aiResponse.usage?.total_tokens;
    if (tokensConsumed !== undefined) {
      logger.info(`OpenAI tokens consumed: ${tokensConsumed}`);
    }

    const translation = await Translation.create({
      hash,
      originalText,
      translatedText,
      originalLanguageCode,
      translatedLanguageCode,
      isApproved: false,
    });
    return response.created(translation);
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
