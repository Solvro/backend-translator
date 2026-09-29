/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/
import { Env } from "@adonisjs/core/env";

export default await Env.create(new URL("../", import.meta.url), {
  NODE_ENV: Env.schema.enum(["development", "production", "test"] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: "host" }),
  LOG_LEVEL: Env.schema.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
  ]),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: "host" }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Custom environment variables
  |----------------------------------------------------------
  */
  OPENAI_API_KEY: Env.schema.string(),

  /*
  |--------------------------------------------------------------------------
  | Translation backend
  |--------------------------------------------------------------------------
  |
  | "openai" talks to OpenAI directly, "nvidia" uses the OpenAI-compatible
  | NVIDIA NIM endpoint (free preview models, e.g. nemotron-3-super).
  |
  */
  TRANSLATION_PROVIDER: Env.schema.string.optional(),
  TRANSLATION_MODEL: Env.schema.string.optional(),
  TRANSLATION_CONCURRENCY: Env.schema.string.optional(),
  NVIDIA_API_KEY: Env.schema.string.optional(),
  NVIDIA_BASE_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(["cookie", "memory"] as const),
});
