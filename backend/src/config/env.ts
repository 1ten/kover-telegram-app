import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_INIT_DATA_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  START_BOT: z.coerce.boolean().default(false),
  ADMIN_TELEGRAM_IDS: z.string().default(""),
  ADMIN_CHAT_IDS: z.string().default(""),
  YOOKASSA_SHOP_ID: z.string().min(1),
  YOOKASSA_SECRET_KEY: z.string().min(1),
  YOOKASSA_RETURN_URL: z.string().url(),
  YOOKASSA_ALLOWED_IPS: z.string().default("")
});

export const env = envSchema.parse({
  ...process.env,
  BACKEND_PORT: process.env.BACKEND_PORT ?? process.env.PORT
});

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const adminTelegramIds = new Set(splitCsv(env.ADMIN_TELEGRAM_IDS));
export const adminChatIds = splitCsv(env.ADMIN_CHAT_IDS);
export const yookassaAllowedIps = splitCsv(env.YOOKASSA_ALLOWED_IPS);
