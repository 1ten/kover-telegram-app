import { Router } from "express";
import { asyncRoute } from "../lib/asyncRoute.js";
import { getCurrentPeriod } from "../lib/dates.js";
import { getSettings } from "../lib/settings.js";
import { prisma } from "../lib/prisma.js";
import { getPaymentAmount, resolvePaymentStatus } from "../lib/paymentState.js";

export const meRouter = Router();

meRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    res.json({ musician: req.musician });
  })
);

meRouter.get(
  "/summary",
  asyncRoute(async (req, res) => {
    const musician = req.musician!;
    const period = getCurrentPeriod();
    const settings = await getSettings();
    const [payment, history] = await Promise.all([
      prisma.payment.findUnique({
        where: { musicianId_period: { musicianId: musician.id, period } }
      }),
      prisma.payment.findMany({
        where: { musicianId: musician.id },
        orderBy: { createdAt: "desc" },
        take: 20
      })
    ]);

    const paymentState = resolvePaymentStatus({ musician, settings, period, payment });

    res.json({
      musician,
      period,
      payment,
      amount: getPaymentAmount(musician, payment),
      history,
      ...paymentState
    });
  })
);
