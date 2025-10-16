import { createHash, randomBytes } from "node:crypto";

import { test } from "@japa/runner";

import ApiToken from "#models/api_token";
import Language from "#models/language";
import Translation from "#models/translation";
import UrlTranslation from "#models/url_translation";

interface TranslationResponse {
  translatedText: string;
}

interface BatchTranslationResult {
  originalText: string;
  translation: {
    hash: string;
    originalText: string;
    translatedText: string;
    originalLanguageCode: string;
    translatedLanguageCode: string;
    isApproved: boolean;
  } | null;
  success: boolean;
  error?: string;
}

interface BatchTranslationResponseBody {
  translations: BatchTranslationResult[];
  total: number;
  successful: number;
  failed: number;
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Tests should not run in production environment");
}

if (process.env.NODE_ENV !== "test") {
  throw new Error("Tests must run in test environment");
}

if (process.env.DB_DATABASE !== "backend_translator_test_only_tests") {
  throw new Error(
    "Tests must run against backend_translator_test_only_tests database",
  );
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

    response.assertStatus(200);
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

    response.assertStatus(200);
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

    response.assertStatus(200);
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

    response.assertStatus(200);
    response.assertBodyContains({
      originalText: textWithTrailingSlash,
      translatedText: "Bonjour https://example.com/blog-fr/",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: false,
    });
  });

  test("should translate Solvro portfolio URL from Polish to English", async ({
    client,
  }) => {
    await Language.create({ isoCode: "pl" });
    await Language.create({ isoCode: "en" });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl",
      targetUrl: "https://solvro.pl/en",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl/portfolio",
      targetUrl: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    const textWithSolvroUrl = "https://solvro.pl/pl/portfolio";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithSolvroUrl,
        originalLanguageCode: "pl",
        translatedLanguageCode: "en",
      })
      .header("x-api-token", token);

    response.assertStatus(200);
    response.assertBodyContains({
      originalText: textWithSolvroUrl,
      translatedText: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
      isApproved: false,
    });
  });

  test("should translate Solvro portfolio URL from Polish to English", async ({
    client,
  }) => {
    await Language.create({ isoCode: "pl" });
    await Language.create({ isoCode: "en" });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl",
      targetUrl: "https://solvro.pl/en",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl/",
      targetUrl: "https://solvro.pl/en/",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl/portfolio",
      targetUrl: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    const textWithSolvroUrl = "https://solvro.pl/pl/portfolio";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithSolvroUrl,
        originalLanguageCode: "pl",
        translatedLanguageCode: "en",
      })
      .header("x-api-token", token);

    response.assertStatus(200);
    response.assertBodyContains({
      originalText: textWithSolvroUrl,
      translatedText: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
      isApproved: false,
    });
  });

  test("should translate Solvro portfolio URL from Polish to English", async ({
    client,
  }) => {
    await Language.create({ isoCode: "pl" });
    await Language.create({ isoCode: "en" });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl/",
      targetUrl: "https://solvro.pl/en/",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/pl/portfolio",
      targetUrl: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    const textWithSolvroUrl = "https://solvro.pl/pl/portfolio";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithSolvroUrl,
        originalLanguageCode: "pl",
        translatedLanguageCode: "en",
      })
      .header("x-api-token", token);

    response.assertStatus(200);
    response.assertBodyContains({
      originalText: textWithSolvroUrl,
      translatedText: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
      isApproved: false,
    });
  });

  test("should translate Solvro portfolio URL from Polish to English", async ({
    client,
  }) => {
    await Language.create({ isoCode: "pl" });
    await Language.create({ isoCode: "en" });

    await UrlTranslation.create({
      sourceUrl: "https://solvro.pl/",
      targetUrl: "https://solvro.pl/en/",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
    });

    const textWithSolvroUrl = "https://solvro.pl/portfolio";

    const response = await client
      .post("/api/v1/translations/openAI")
      .json({
        originalText: textWithSolvroUrl,
        originalLanguageCode: "pl",
        translatedLanguageCode: "en",
      })
      .header("x-api-token", token);

    response.assertStatus(200);
    response.assertBodyContains({
      originalText: textWithSolvroUrl,
      translatedText: "https://solvro.pl/en/portfolio",
      originalLanguageCode: "pl",
      translatedLanguageCode: "en",
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

    firstResponse.assertStatus(200);
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

    firstResponse.assertStatus(200);
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

  test("should handle concurrent requests for the same translation without race condition", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    const textToTranslate = "Hello, testing concurrent requests";

    // Make two parallel requests for the same translation
    const [firstResponse, secondResponse] = await Promise.all([
      client
        .post("/api/v1/translations/openAI")
        .json({
          originalText: textToTranslate,
          originalLanguageCode: "en",
          translatedLanguageCode: "fr",
        })
        .header("x-api-token", token),
      client
        .post("/api/v1/translations/openAI")
        .json({
          originalText: textToTranslate,
          originalLanguageCode: "en",
          translatedLanguageCode: "fr",
        })
        .header("x-api-token", token),
    ]);

    firstResponse.assertStatus(200);
    secondResponse.assertStatus(200);

    // Both responses should contain the same translation
    const firstTranslation = (firstResponse.body() as TranslationResponse)
      .translatedText;
    const secondTranslation = (secondResponse.body() as TranslationResponse)
      .translatedText;

    assert.equal(firstTranslation, secondTranslation);

    // Verify that only one translation was stored in the database
    const hash = createHash("sha256").update(textToTranslate).digest("hex");
    const storedTranslations = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", "fr");

    assert.equal(storedTranslations.length, 1);
    assert.equal(storedTranslations[0].originalText, textToTranslate);
    assert.equal(storedTranslations[0].translatedText, firstTranslation);
  });

  test("should translate multiple texts using batch endpoint", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    const texts = ["Hello", "Good morning", "How are you?"];

    const response = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        texts,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(200);

    const body = response.body() as BatchTranslationResponseBody;
    assert.equal(body.total, 3);
    assert.equal(body.successful, 3);
    assert.equal(body.failed, 0);
    assert.isArray(body.translations);
    assert.equal(body.translations.length, 3);

    // Verify all translations have the expected structure
    body.translations.forEach((result, index) => {
      const expectedText = texts[index];
      assert.equal(result.originalText, expectedText);
      assert.isTrue(result.success);
      const translation = result.translation;
      if (translation === null) {
        throw new Error("Expected translation to be present");
      }
      assert.equal(translation.originalText, expectedText);
      assert.equal(translation.originalLanguageCode, "en");
      assert.equal(translation.translatedLanguageCode, "fr");
      assert.isFalse(translation.isApproved);
    });

    // Verify all translations were stored in the database
    for (const text of texts) {
      const hash = createHash("sha256").update(text).digest("hex");
      const storedTranslation = await Translation.query()
        .where("hash", hash)
        .where("translatedLanguageCode", "fr")
        .first();

      assert.exists(storedTranslation);
      assert.equal(storedTranslation?.originalText, text);
    }
  });

  test("should handle batch translation with existing translations", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    // Create an existing translation
    const existingText = "Hello";
    const existingHash = createHash("sha256")
      .update(existingText)
      .digest("hex");
    await Translation.create({
      hash: existingHash,
      originalText: existingText,
      translatedText: "Bonjour",
      originalLanguageCode: "en",
      translatedLanguageCode: "fr",
      isApproved: true,
    });

    const texts = ["Hello", "Good morning"];

    const response = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        texts,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(200);

    const body = response.body() as BatchTranslationResponseBody;
    assert.equal(body.total, 2);
    assert.equal(body.successful, 2);
    assert.equal(body.failed, 0);

    // Verify the existing translation was returned without modification
    const helloResult = body.translations.find(
      (t: { originalText: string }) => t.originalText === "Hello",
    );
    if (helloResult === undefined) {
      throw new Error("Expected existing translation to be returned");
    }
    const helloTranslation = helloResult.translation;
    if (helloTranslation === null) {
      throw new Error("Expected existing translation to be returned");
    }
    assert.equal(helloTranslation.translatedText, "Bonjour");
    assert.isTrue(helloTranslation.isApproved);
  });

  test("should handle batch translation with URL replacements", async ({
    client,
    assert,
  }) => {
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

    const texts = [
      "Visit https://example.com/page1 for more info",
      "Check out https://example.com/page2",
    ];

    const response = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        texts,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(200);

    const body = response.body() as BatchTranslationResponseBody;
    assert.equal(body.successful, 2);

    // Verify URLs were replaced in the translations
    for (const result of body.translations) {
      assert.isTrue(result.success);
      if (result.originalText.includes("page1")) {
        const translation = result.translation;
        if (translation === null) {
          throw new Error("Expected translation to be present");
        }
        assert.include(
          translation.translatedText,
          "https://example.com/page1-fr",
        );
      }
      if (result.originalText.includes("page2")) {
        const translation = result.translation;
        if (translation === null) {
          throw new Error("Expected translation to be present");
        }
        assert.include(
          translation.translatedText,
          "https://example.com/page2-fr",
        );
      }
    }
  });

  test("should validate batch translation request body", async ({ client }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    // Missing texts array
    const response1 = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response1.assertStatus(422);

    // Empty texts array
    const response2 = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        texts: [],
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response2.assertStatus(422);

    // Invalid language code
    const response3 = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        texts: ["Hello"],
        originalLanguageCode: "invalid",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response3.assertStatus(422);
  });

  test("should handle batch translation with duplicate texts", async ({
    client,
    assert,
  }) => {
    await Language.create({ isoCode: "en" });
    await Language.create({ isoCode: "fr" });

    const texts = ["Hello", "Hello", "Good morning"];

    const response = await client
      .post("/api/v1/translations/openAI/batch")
      .json({
        texts,
        originalLanguageCode: "en",
        translatedLanguageCode: "fr",
      })
      .header("x-api-token", token);

    response.assertStatus(200);

    const body = response.body() as BatchTranslationResponseBody;
    assert.equal(body.total, 3);
    assert.equal(body.successful, 3);

    // Verify that duplicate "Hello" entries have the same translation
    const helloTranslations = body.translations.filter(
      (t: { originalText: string }) => t.originalText === "Hello",
    );
    assert.equal(helloTranslations.length, 2);
    const [firstHello, secondHello] = helloTranslations;
    if (firstHello.translation === null || secondHello.translation === null) {
      throw new Error("Expected translations for duplicate texts");
    }
    assert.equal(
      firstHello.translation.translatedText,
      secondHello.translation.translatedText,
    );

    // Verify only one translation was stored for "Hello"
    const hash = createHash("sha256").update("Hello").digest("hex");
    const storedTranslations = await Translation.query()
      .where("hash", hash)
      .where("translatedLanguageCode", "fr");

    assert.equal(storedTranslations.length, 1);
  });
});
