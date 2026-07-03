import { Bot, InlineKeyboard } from "grammy";
import { adminTelegramIds, env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { startReminderCron } from "./reminders.js";

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

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

startReminderCron(bot);

bot.catch((error) => {
  console.error("bot_error", error);
});

bot.start({
  onStart: (info) => {
    console.log(`bot_started @${info.username}`);
  }
});

const shutdown = async () => {
  await bot.stop();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
