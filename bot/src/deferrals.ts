import type { Bot } from "grammy";
import { adminTelegramIds } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

export const registerDeferralCallbacks = (bot: Bot) => {
  bot.callbackQuery(/^deferral:(approve|reject):(.+)$/, async (ctx) => {
    const adminId = ctx.from?.id ? String(ctx.from.id) : "";

    if (!adminTelegramIds.has(adminId)) {
      await ctx.answerCallbackQuery({ text: "Недостаточно прав", show_alert: true });
      return;
    }

    const action = ctx.match[1] as "approve" | "reject";
    const requestId = ctx.match[2];
    const status = action === "approve" ? "approved" : "rejected";
    const request =
      status === "approved"
        ? await prisma.deferralRequest.update({
            where: { id: requestId },
            data: {
              status,
              resolvedAt: new Date()
            },
            include: { musician: true }
          })
        : await prisma.deferralRequest.delete({
            where: { id: requestId },
            include: { musician: true }
          });

    if (status === "approved") {
      await prisma.payment.updateMany({
        where: {
          musicianId: request.musicianId,
          period: request.period,
          status: "overdue"
        },
        data: { status: "pending" }
      });
    }

    await ctx.api.sendMessage(
      request.musician.telegramId.toString(),
      status === "approved"
        ? `Заявка на отсрочку за ${request.period} одобрена.`
        : `Заявка на отсрочку за ${request.period} отклонена.`
    );

    await ctx.answerCallbackQuery({
      text: status === "approved" ? "Одобрено" : "Отклонено"
    });

    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  });
};
