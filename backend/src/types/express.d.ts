import type { Musician } from "@prisma/client";
import type { TelegramWebAppUser } from "../auth/telegram.js";

declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramWebAppUser;
      musician?: Musician;
    }
  }
}

export {};
