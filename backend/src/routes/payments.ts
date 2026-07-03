import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { asyncRoute } from "../lib/asyncRoute.js";
import { getCurrentPeriod } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { paymentProvider } from "../payments/provider.js";

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

    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          musicianId: musician.id,
          amount,
          period,
          status: "pending"
        }
      });
    } else if (payment.amount !== amount || payment.status !== "pending") {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          amount,
          status: "pending"
        }
      });
    }

    const providerPayment = await paymentProvider.createPayment({
      amount,
      description: `KOVER: репетиции за ${period}`,
      returnUrl: env.YOOKASSA_RETURN_URL,
      metadata: {
        paymentId: payment.id,
        musicianId: musician.id,
        period
      }
    });

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        yookassaPaymentId: providerPayment.providerPaymentId,
        status: "pending"
      }
    });

    logger.info("payment_created", {
      paymentId: payment.id,
      providerPaymentId: providerPayment.providerPaymentId,
      musicianId: musician.id,
      period,
      amount
    });

    res.status(201).json({
      payment: updatedPayment,
      confirmationUrl: providerPayment.confirmationUrl,
      manualPayment: !providerPayment.confirmationUrl
    });
  })
);
