import router from "@adonisjs/core/services/router";

const TranslationsController = () =>
  import("#controllers/translations_controller");
const LanguagesController = () => import("#controllers/languages_controller");

router.get("/", async () => {
  return {
    hello: "world",
  };
});

router
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
        router.get("/:hash", [TranslationsController, "show"]);
        router.put("/:hash", [TranslationsController, "update"]);
        router.delete("/:hash", [TranslationsController, "destroy"]);
        router.post("/:hash/approve", [TranslationsController, "approve"]);
        router.post("/openAI", [
          TranslationsController,
          "requestTranslationOpenAI",
        ]);
      })
      .prefix("/translations");
  })
  .prefix("/api/v1");
