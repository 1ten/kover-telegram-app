import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  ADMIN_TELEGRAM_IDS: z.string().default("")
});

export const env = envSchema.parse(process.env);

export const adminTelegramIds = new Set(
  env.ADMIN_TELEGRAM_IDS.split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);
