import { Bot, InlineKeyboard } from "grammy";
import { adminTelegramIds, env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { registerDeferralCallbacks } from "./deferrals.js";
import { startReminderCron } from "./reminders.js";

let bot: Bot | undefined;

export const startEmbeddedBot = async () => {
  if (bot) {
    return bot;
  }

  bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  await bot.api
    .setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "KOVER",
        web_app: {
          url: env.FRONTEND_URL
        }
      }
    })
    .catch((error) => {
      logger.error("bot_menu_button_setup_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    });

  bot.command("start", async (ctx) => {
    const telegramId = BigInt(ctx.from!.id);
    const isAdmin = adminTelegramIds.has(String(ctx.from!.id));
    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || null;
    const existing = await prisma.musician.findUnique({ where: { telegramId } });

    if (existing) {
      await prisma.musician.update({
        where: { id: existing.id },
        data: {
          username: ctx.from?.username,
          fullName,
          isAdmin: existing.isAdmin || isAdmin
        }
      });
    } else {
      await prisma.musician.create({
        data: {
          telegramId,
          username: ctx.from?.username,
          fullName,
          isAdmin
        }
      });
    }

    await ctx.reply("KOVER", {
      reply_markup: new InlineKeyboard().webApp("Открыть приложение", env.FRONTEND_URL)
    });
  });

  registerDeferralCallbacks(bot);
  startReminderCron(bot);

  bot.catch((error) => {
    logger.error("bot_error", { message: String(error.error) });
  });

  await bot.start({
    onStart: (info) => {
      logger.info("embedded_bot_started", { username: info.username });
    }
  });

  return bot;
};

export const stopEmbeddedBot = async () => {
  if (!bot) {
    return;
  }

  await bot.stop();
  bot = undefined;
};
