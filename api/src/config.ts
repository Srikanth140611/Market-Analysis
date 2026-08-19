import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  MARKETAUX_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_WEBHOOK_URLS: z.string().optional(),
  SLACK_NOTIFY_USER_IDS: z.string().optional(),
  AUTO_NEWS_TO_SLACK_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  STRICT_LIVE_MODE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  NEWS_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  ALLOWED_ORIGIN: z.string().default("*")
});

export const config = schema.parse(process.env);
