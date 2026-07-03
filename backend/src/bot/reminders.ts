import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { getCurrentPeriod, getPaymentDeadline, hhmm, isSameLocalDate } from "./dates.js";

const sentInProcess = new Set<string>();

const textByType = {
  before: (period: string) => `Напоминание KOVER: скоро оплата репетиций за ${period}.`,
  due: (period: string) => `Сегодня день оплаты KOVER за ${period}.`,
  overdue: (period: string) =>
    `Оплата KOVER за ${period} просрочена. Пожалуйста, откройте приложение и нажмите «Оплатить».`
};

const appKeyboard = () => new InlineKeyboard().webApp("Открыть KOVER", env.FRONTEND_URL);

export const startReminderCron = (bot: Bot) => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const settings = await prisma.settings.upsert({
        where: { id: "global" },
        update: {},
        create: { id: "global" }
      });

      if (hhmm(now) !== settings.reminderTime) {
        return;
      }

      const period = getCurrentPeriod(now);
      const musicians = await prisma.musician.findMany({
        where: { status: "active" },
        include: {
          payments: { where: { period } }
        }
      });

      for (const musician of musicians) {
        const payment = musician.payments[0];

        if (payment?.status === "paid") {
          continue;
        }

        const { dueAt, graceEndsAt } = getPaymentDeadline(musician, settings, period);
        const beforeDate = new Date(dueAt);
        beforeDate.setDate(beforeDate.getDate() - settings.reminderDaysBefore);

        const type = isSameLocalDate(now, beforeDate)
          ? "before"
          : isSameLocalDate(now, dueAt)
            ? "due"
            : now > graceEndsAt
              ? "overdue"
              : null;

        if (!type) {
          continue;
        }

        const key = `${musician.id}:${period}:${type}`;

        if (sentInProcess.has(key)) {
          continue;
        }

        sentInProcess.add(key);
        await bot.api.sendMessage(musician.telegramId.toString(), textByType[type](period), {
          reply_markup: appKeyboard()
        });
      }
    } catch (error) {
      logger.error("bot_reminder_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
};
