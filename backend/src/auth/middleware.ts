import type { NextFunction, Request, Response } from "express";
import { adminTelegramIds, env } from "../config/env.js";
import { getSettings } from "../lib/settings.js";
import { prisma } from "../lib/prisma.js";
import { validateTelegramInitData } from "./telegram.js";

const getInitDataFromRequest = (req: Request) => {
  const authHeader = req.header("authorization") ?? "";

  if (authHeader.toLowerCase().startsWith("tma ")) {
    return authHeader.slice(4);
  }

  return req.header("x-telegram-init-data") ?? "";
};

export const authenticateTelegram = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const initData = getInitDataFromRequest(req);

    if (!initData) {
      res.status(401).json({ error: "Telegram initData is required" });
      return;
    }

    const { user } = validateTelegramInitData(
      initData,
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_INIT_DATA_TTL_SECONDS
    );

    const telegramId = BigInt(user.id);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
    const isEnvAdmin = adminTelegramIds.has(String(user.id));
    const existing = await prisma.musician.findUnique({ where: { telegramId } });

    const musician = existing
      ? await prisma.musician.update({
          where: { id: existing.id },
          data: {
            username: user.username ?? existing.username,
            fullName,
            isAdmin: existing.isAdmin || isEnvAdmin
          }
        })
      : await prisma.musician.create({
          data: {
            telegramId,
            username: user.username,
            fullName,
            isAdmin: isEnvAdmin,
            paymentDay: (await getSettings()).defaultPaymentDay
          }
        });

    req.telegramUser = user;
    req.musician = musician;
    next();
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Telegram auth failed"
    });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.musician?.isAdmin) {
    res.status(403).json({ error: "Admin access is required" });
    return;
  }

  next();
};
