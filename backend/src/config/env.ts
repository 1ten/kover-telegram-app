import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    BACKEND_PORT: z.coerce.number().int().positive().default(4000),
    FRONTEND_URL: z.string().url(),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_INIT_DATA_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
    START_BOT: z.coerce.boolean().default(false),
    ADMIN_TELEGRAM_IDS: z.string().default(""),
    ADMIN_CHAT_IDS: z.string().default(""),
    PAYMENT_PROVIDER: z.enum(["manual", "yookassa"]).default("manual"),
    YOOKASSA_SHOP_ID: z.string().default(""),
    YOOKASSA_SECRET_KEY: z.string().default(""),
    YOOKASSA_RETURN_URL: z.string().default(""),
    YOOKASSA_ALLOWED_IPS: z.string().default("")
  })
  .superRefine((value, ctx) => {
    if (value.PAYMENT_PROVIDER !== "yookassa") {
      return;
    }

    if (!value.YOOKASSA_SHOP_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["YOOKASSA_SHOP_ID"],
        message: "YOOKASSA_SHOP_ID is required when PAYMENT_PROVIDER=yookassa"
      });
    }

    if (!value.YOOKASSA_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["YOOKASSA_SECRET_KEY"],
        message: "YOOKASSA_SECRET_KEY is required when PAYMENT_PROVIDER=yookassa"
      });
    }

    if (!z.string().url().safeParse(value.YOOKASSA_RETURN_URL).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["YOOKASSA_RETURN_URL"],
        message: "YOOKASSA_RETURN_URL must be a valid URL when PAYMENT_PROVIDER=yookassa"
      });
    }
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
