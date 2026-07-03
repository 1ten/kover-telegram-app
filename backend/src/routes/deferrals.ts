import { Router } from "express";
import { getCurrentPeriod } from "../lib/dates.js";
import { asyncRoute } from "../lib/asyncRoute.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { notifyAdminsAboutDeferral } from "../telegram/notify.js";

export const deferralsRouter = Router();

const displayName = (musician: { fullName: string | null; username: string | null; telegramId: bigint }) =>
  musician.fullName || (musician.username ? `@${musician.username}` : musician.telegramId.toString());

deferralsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const requests = await prisma.deferralRequest.findMany({
      where: { musicianId: req.musician!.id },
      orderBy: { requestedAt: "desc" }
    });

    res.json({ requests });
  })
);

deferralsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const musician = req.musician!;
    const period = getCurrentPeriod();
    const existing = await prisma.deferralRequest.findUnique({
      where: { musicianId_period: { musicianId: musician.id, period } }
    });

    const request = existing
      ? await prisma.deferralRequest.update({
          where: { id: existing.id },
          data: {
            status: "pending",
            requestedAt: new Date(),
            resolvedAt: null,
            adminComment: null
          }
        })
      : await prisma.deferralRequest.create({
          data: {
            musicianId: musician.id,
            period,
            status: "pending"
          }
        });

    await notifyAdminsAboutDeferral({
      requestId: request.id,
      musicianName: displayName(musician),
      period
    });

    logger.info("deferral_requested", {
      requestId: request.id,
      musicianId: musician.id,
      period
    });

    res.status(existing ? 200 : 201).json({ request });
  })
);
