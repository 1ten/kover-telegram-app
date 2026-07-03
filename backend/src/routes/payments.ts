import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../lib/asyncRoute.js";
import { getCurrentPeriod } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

export const paymentsRouter = Router();

const createPaymentSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

paymentsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: { musicianId: req.musician!.id },
      orderBy: { createdAt: "desc" }
    });

    res.json({ payments });
  })
);

paymentsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const musician = req.musician!;

    if (musician.status === "archived") {
      res.status(403).json({ error: "Archived musicians cannot create payments" });
      return;
    }

    const body = createPaymentSchema.parse(req.body);
    const period = body.period ?? getCurrentPeriod();
    const amount = musician.monthlyPrice;

    let payment = await prisma.payment.findUnique({
      where: { musicianId_period: { musicianId: musician.id, period } }
    });

    if (payment?.status === "paid") {
      res.json({ payment, alreadyPaid: true });
      return;
    }

    const now = new Date();

    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          musicianId: musician.id,
          amount,
          period,
          status: "paid",
          paidAt: now
        }
      });
    } else {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          amount,
          status: "paid",
          paidAt: payment.paidAt ?? now,
          yookassaPaymentId: null
        }
      });
    }

    logger.info("payment_marked_by_participant", {
      paymentId: payment.id,
      musicianId: musician.id,
      period,
      amount
    });

    res.status(201).json({
      payment
    });
  })
);
