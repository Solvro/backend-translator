# backend-translator

![Solvro banner](https://github.com/Solvro/backend-topwr-sks/blob/main/assets/solvro_dark.png#gh-dark-mode-only)
![Solvro banner](https://github.com/Solvro/backend-topwr-sks/blob/main/assets/solvro_dark.png#gh-light-mode-only)

# Translation API Documentation

## Base URL

```
/api/v1
```

## Endpoints

### Languages

#### Get All Languages

```
GET /languages
```

**Response:** List of all available languages.

#### Create a Language

```
POST /languages
```

**Body:**

```json
{
  "isoCode": "en",
  "name": "English"
}
```

**Response:** Created language object.

#### Get Language by ISO Code

```
GET /languages/:isoCode
```

**Response:** Language object.

#### Update Language

```
PUT /languages/:isoCode
```

**Body:**

```json
{
  "name": "Updated Name"
}
```

**Response:** Updated language object.

#### Delete Language

```
DELETE /languages/:isoCode
```

**Response:** No content.

---

### Translations

#### Get All Translations

```
GET /translations
```

**Response:** List of all translations.

#### Create a Translation

```
POST /translations
```

**Body:**

```json
{
  "originalText": "Hello",
  "originalLanguageCode": "en",
  "translatedLanguageCode": "fr",
  "translatedText": "Bonjour"
}
```

**Response:** Created translation object.

#### Get Translations for a Specific Text

```
GET /translations/:hash
```

**Response:** List of translations for the given text hash.

#### Get Translations for a Specific Language

```
GET /translations/:isoCode
```

**Response:** List of translations in the given language.

#### Get Specific Translation

```
GET /translations/:hash/:isoCode
```

**Response:** Translation object.

#### Update Translation

```
PUT /translations/:hash/:isoCode
```

**Body:**

```json
{
  "originalText": "Hello",
  "translatedText": "Salut"
}
```

**Response:** Updated translation object.

#### Delete Translation

```
DELETE /translations/:hash/:isoCode
```

**Response:** No content.

#### Approve Translation

```
POST /translations/:hash/:isoCode/approve
```

**Response:** Approved translation object.

#### Request Translation via OpenAI

```
POST /translations/openAI
```

**Body:**

```json
{
  "originalText": "Hello",
  "originalLanguageCode": "en",
  "translatedLanguageCode": "es"
}
```

**Response:** Translation object created using OpenAI.

---

## Notes

- The `hash` parameter is generated using SHA-256 from `originalText`.
- The OpenAI translation request utilizes `gpt-4o-mini`.
- All responses follow JSON format.
- Errors return appropriate HTTP status codes with messages.
- **The API is generated by ChatGPT - watch out for inconsistencies**

## Links

[![docs.solvro.pl](https://i.imgur.com/fuV0gra.png)](https://docs.solvro.pl)
