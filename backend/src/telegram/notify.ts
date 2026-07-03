import { adminChatIds, env } from "../config/env.js";
import { logger } from "../lib/logger.js";

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

const sendMessage = async (
  chatId: string,
  text: string,
  inlineKeyboard?: InlineKeyboardButton[][]
) => {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined
    })
  });

  if (!response.ok) {
    logger.warn("telegram_message_failed", {
      chatId,
      status: response.status,
      body: await response.text()
    });
  }
};

export const notifyAdminsAboutDeferral = async (input: {
  requestId: string;
  musicianName: string;
  period: string;
}) => {
  await Promise.all(
    adminChatIds.map((chatId) =>
      sendMessage(
        chatId,
        `Новая заявка на отсрочку\n\nУчастник: <b>${input.musicianName}</b>\nПериод: <b>${input.period}</b>`,
        [
          [
            { text: "Одобрить", callback_data: `deferral:approve:${input.requestId}` },
            { text: "Отклонить", callback_data: `deferral:reject:${input.requestId}` }
          ]
        ]
      )
    )
  );
};

export const notifyParticipant = async (telegramId: bigint, text: string) => {
  await sendMessage(telegramId.toString(), text);
};
