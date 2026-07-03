import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const sendMessage = async (chatId: string, text: string) => {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
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

export const notifyParticipant = async (telegramId: bigint, text: string) => {
  await sendMessage(telegramId.toString(), text);
};
