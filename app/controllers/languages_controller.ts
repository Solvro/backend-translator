import type { HttpContext } from "@adonisjs/core/http";

import Language from "#models/language";
import {
  createLanguageValidator,
  updateLanguageValidator,
} from "#validators/language";

export default class LanguagesController {
  /**
   * Display a list of resource
   */
  async index() {
    return await Language.all();
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createLanguageValidator);
    const language = await Language.create(data);
    return response.created(language);
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return await Language.findOrFail(params.isoCode);
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const data = await request.validateUsing(updateLanguageValidator);
    const language = await Language.findOrFail(params.isoCode);
    language.merge(data);
    await language.save();
    return language;
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const language = await Language.findOrFail(params.isoCode);
    await language.delete();
  }
}
