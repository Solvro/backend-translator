import router from "@adonisjs/core/services/router";

import { middleware } from "#start/kernel";

const TranslationsController = () =>
  import("#controllers/translations_controller");
const LanguagesController = () => import("#controllers/languages_controller");
const CacheReferenceController = () =>
  import("#controllers/cache_reference_controller");

router.get("/", async () => {
  return {
    elo: "zelo",
  };
});

router
  .group(() => {
    router

      /*
       * Auth protected routes
       */

      .group(() => {
        router
          .group(() => {
            router.get("", [LanguagesController, "index"]);
            router.post("", [LanguagesController, "store"]);
            router.get(":isoCode", [LanguagesController, "show"]);
            router.put("/:isoCode", [LanguagesController, "update"]);
            router.delete("/:isoCode", [LanguagesController, "destroy"]);
          })
          .prefix("/languages");

        router
          .group(() => {
            router.get("", [TranslationsController, "index"]);
            router.post("", [TranslationsController, "store"]);
            router.get("/:hash", [
              TranslationsController,
              "translationsForText",
            ]);
            router.get("/language/:isoCode", [
              TranslationsController,
              "translationsForLanguage",
            ]);
            router.get("/:hash/:isoCode", [TranslationsController, "show"]);
            router.put("/:hash/:isoCode", [TranslationsController, "update"]);
            router.delete("/:hash/:isoCode", [
              TranslationsController,
              "destroy",
            ]);
            router.post("/:hash/:isoCode/approve", [
              TranslationsController,
              "approve",
            ]);
            router.post("/openAI", [
              TranslationsController,
              "requestTranslationOpenAI",
            ]);
          })
          .prefix("/translations");

        router.post("cache_reference_number", [
          CacheReferenceController,
          "bump",
        ]);
      })
      .use(middleware.auth());

    /*
     * Unprotected routes
     */

    router.get("cache_reference_number", [CacheReferenceController, "index"]);
  })
  .prefix("/api/v1");
