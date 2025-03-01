import { createHash } from "node:crypto";
import OpenAI from "openai";

import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import Translation from "#models/translation";
import env from "#start/env";

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
    const data = request.only([
      "originalText",
      "translatedText",
      "originalLanguageCode",
      "translatedLanguageCode",
    ]) as {
      originalText: string;
      translatedText: string;
      originalLanguageCode: string;
      translatedLanguageCode: string;
    };

    const hash = createHash("sha256").update(data.originalText).digest("hex");
    const existingTranslation = await Translation.find(hash);
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
    return await Translation.findOrFail(params.hash);
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response }: HttpContext) {
    const translation = await Translation.findOrFail(params.hash);

    const data = request.only([
      "originalText",
      "translatedText",
      "originalLanguageCode",
      "translatedLanguageCode",
    ]) as {
      originalText: string;
      translatedText: string;
      originalLanguageCode: string;
      translatedLanguageCode: string;
    };

    const hash = createHash("sha256").update(data.originalText).digest("hex");
    const existingTranslation = await Translation.find(hash);
    if (existingTranslation !== null) {
      return response.conflict({ message: "Translation already exists." });
    }

    translation.merge({
      hash,
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
    const translation = await Translation.findOrFail(params.hash);
    await translation.delete();
  }

  /**
   * Approve translation
   */
  async approve({ params }: HttpContext) {
    const translation = await Translation.findOrFail(params.hash);
    translation.isApproved = true;
    await translation.save();
    return translation;
  }

  /**
   * Request translation by OpenAI
   */
  async requestTranslationOpenAI({ request, response }: HttpContext) {
    const data = request.only([
      "originalText",
      "originalLanguageCode",
      "translatedLanguageCode",
    ]) as {
      originalText: string;
      originalLanguageCode: string;
      translatedLanguageCode: string;
    };

    const hash = createHash("sha256").update(data.originalText).digest("hex");
    const existingTranslation = await Translation.find(hash);
    if (existingTranslation !== null) {
      return response.conflict({ message: "Translation already exists." });
    }

    //TODO: get someone from ML team to review this
    const systemPrompt = `You are a translation tool. You receive a string written in
    polish language, and solely return the same string in english language
    without losing the original formatting. Your translations are accurate, aiming not to deviate from the original
    structure, content, writing style and tone. The language were defined as ISO 639-1 codes. Do not add any additional information.`;

    const aiParams: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [
        { role: "developer", content: systemPrompt },
        { role: "user", content: data.originalText },
      ],
      model: "gpt-4o-mini",
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
      originalText: data.originalText,
      translatedText,
      originalLanguageCode: data.originalLanguageCode,
      translatedLanguageCode: data.translatedLanguageCode,
      isApproved: false,
    });
    return response.created(translation);
  }
}
