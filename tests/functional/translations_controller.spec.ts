import { createHash, randomBytes } from "node:crypto";

import { test } from "@japa/runner";

import ApiToken from "#models/api_token";
import Language from "#models/language";
import Translation from "#models/translation";
import UrlTranslation from "#models/url_translation";

interface TranslationResponse {
  translatedText: string;
}

test.group("Translations Controller", (group) => {
  let token: string;

  group.each.setup(async () => {
    await Translation.query().delete();
    await UrlTranslation.query().delete();
    await Language.query().delete();
    await ApiToken.query().delete();

    token = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(token).digest("hex");
    await ApiToken.create({ name: "test-token", hash: hashedToken });
  });

  test("should translate text using OpenAI", async ({ client, assert }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: "Hello, how are you?",
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(201);
    response.assertBodyContains({
      originalText: "Hello, how are you?",
      translatedText: "Bonjour, comment ça va ?",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });

    // Verify that the translation was stored in the database
    const hash = createHash("sha256")
      .update("Hello, how are you?")
      .digest("hex");
    const storedTranslation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", "fr")
      .first();

    assert.exists(storedTranslation);
    assert.equal(storedTranslation?.originalText, "Hello, how are you?");
    assert.equal(storedTranslation?.translatedText, "Bonjour, comment ça va ?");
    assert.equal(storedTranslation?.originalLanguageCode, "en");
    assert.equal(storedTranslation?.translatedLanguageCode, "fr");
    assert.equal(storedTranslation?.isApproved, false);
  });

  test("should replace URLs based on url_translations table", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    // this is what we want to test
    await UrlTranslation.create({
      sourceUrl: "https://example.com/makaronik",
      targetUrl: "https://example.com/elozelo",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
    });

    const textWithUrl = "Hello https://example.com/makaronik";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithUrl,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(201);
    response.assertBodyContains({
      originalText: textWithUrl,
      translatedText: "Bonjour https://example.com/elozelo",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });

    const hash = createHash("sha256").update(textWithUrl).digest("hex");
    const storedTranslation = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", "fr")
      .first();

    assert.exists(storedTranslation);
    assert.equal(storedTranslation?.originalText, textWithUrl);
    assert.equal(
      storedTranslation?.translatedText,
      "Bonjour https://example.com/makaronik", // this should NOT be translated on purpose
    );
    assert.equal(storedTranslation?.originalLanguageCode, "en");
    assert.equal(storedTranslation?.translatedLanguageCode, "fr");
    assert.equal(storedTranslation?.isApproved, false);
  });

  test("should handle multiple URLs in the same text", async ({ client }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    await UrlTranslation.create({
      sourceUrl: "https://example.com/page1",
      targetUrl: "https://example.com/page1-fr",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
    });

    await UrlTranslation.create({
      sourceUrl: "https://example.com/page2",
      targetUrl: "https://example.com/page2-fr",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
    });

    const textWithMultipleUrls =
      "https://example.com/page1 Hello https://example.com/page2";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithMultipleUrls,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(201);
    response.assertBodyContains({
      originalText: textWithMultipleUrls,
      translatedText:
        "https://example.com/page1-fr Bonjour https://example.com/page2-fr",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });
  });

  test("should handle URLs with trailing slashes", async ({ client }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    await UrlTranslation.create({
      sourceUrl: "https://example.com/blog/",
      targetUrl: "https://example.com/blog-fr/",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
    });

    const textWithTrailingSlash = "Hello https://example.com/blog/";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithTrailingSlash,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(201);
    response.assertBodyContains({
      originalText: textWithTrailingSlash,
      translatedText: "Bonjour https://example.com/blog-fr/",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });
  });

  test("should return cached translation when requesting the same text twice", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    const textToTranslate = "Hello, this is a test for caching";

    // First request
    const firstResponse = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textToTranslate,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    firstResponse.assertStatus(201);
    firstResponse.assertBodyContains({
      originalText: textToTranslate,
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });
    const firstTranslation = (firstResponse.body() as TranslationResponse)
      .translatedText;

    // Second request with the same text
    const secondResponse = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textToTranslate,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    secondResponse.assertStatus(200);

    // Verify that both responses return the same translation
    secondResponse.assertBodyContains({
      originalText: textToTranslate,
      translatedText: firstTranslation,
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });

    // Verify that only one translation was stored in the database
    const hash = createHash("sha256").update(textToTranslate).digest("hex");
    const storedTranslations = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", "fr");

    assert.equal(storedTranslations.length, 1);
  });

  test("should return same translation when requesting long text with URLs twice", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    await UrlTranslation.create({
      sourceUrl: "https://example.com/product",
      targetUrl: "https://example.com/produit",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
    });

    await UrlTranslation.create({
      sourceUrl: "https://example.com/about",
      targetUrl: "https://example.com/a-propos",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
    });

    const longTextWithUrls =
      "Welcome to our website! Check out our products at https://example.com/product. " +
      "We have a wide selection of items for you to choose from. " +
      "For more information about our company, visit https://example.com/about. " +
      "We are committed to providing the best service to our customers. " +
      "Feel free to browse our catalog and find what you need.";

    // First request
    const firstResponse = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: longTextWithUrls,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    firstResponse.assertStatus(201);
    firstResponse.assertBodyContains({
      originalText: longTextWithUrls,
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });
    const firstTranslation = (firstResponse.body() as TranslationResponse)
      .translatedText;

    // Second request with the same text
    const secondResponse = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: longTextWithUrls,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    secondResponse.assertStatus(200);

    // Verify that both responses return the same translation
    secondResponse.assertBodyContains({
      originalText: longTextWithUrls,
      translatedText: firstTranslation,
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });

    // Verify that only one translation was stored in the database
    const hash = createHash("sha256").update(longTextWithUrls).digest("hex");
    const storedTranslations = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", "fr");

    assert.equal(storedTranslations.length, 1);

    // Verify that URLs in the translation were replaced with placeholders
    const urlPattern = /https?:\/\/[^\s]+/g;
    const originalUrls = longTextWithUrls.match(urlPattern) ?? [];
    const translatedUrls = firstTranslation.match(urlPattern) ?? [];

    // The translated text should not contain any of the original URLs
    for (const url of originalUrls) {
      assert.notInclude(firstTranslation, url);
    }

    // The translated text should have placeholder URLs
    assert.equal(translatedUrls.length, originalUrls.length);
  });
});
