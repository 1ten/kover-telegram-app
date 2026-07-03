import { Router } from "express";
import { yookassaAllowedIps } from "../config/env.js";
import { isIpAllowed } from "../lib/ipAllowlist.js";
import { asyncRoute } from "../lib/asyncRoute.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { paymentProvider } from "../payments/yookassaProvider.js";
import { notifyParticipant } from "../telegram/notify.js";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/yookassa",
  asyncRoute(async (req, res) => {
    if (!isIpAllowed(req.ip, yookassaAllowedIps)) {
      res.status(403).json({ error: "IP is not allowed" });
      return;
    }

    const webhook = await paymentProvider.handleWebhook(req.body);
    const providerStatus = await paymentProvider.getPaymentStatus(webhook.providerPaymentId);
    const payment = await prisma.payment.findUnique({
      where: { yookassaPaymentId: webhook.providerPaymentId },
      include: { musician: true }
    });

    logger.info("yookassa_webhook_received", {
      event: webhook.event,
      providerPaymentId: webhook.providerPaymentId,
      providerStatus: providerStatus.status,
      paymentId: payment?.id
    });

    if (!payment) {
      res.sendStatus(200);
      return;
    }

    if (providerStatus.status === "succeeded" && payment.status !== "paid") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "paid",
          paidAt: new Date()
        }
      });
      await notifyParticipant(payment.musician.telegramId, `Оплата за ${payment.period} получена.`);
    }

    if (
      (providerStatus.status === "canceled" || providerStatus.status === "failed") &&
      payment.status !== "paid"
    ) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" }
      });
    }

    res.sendStatus(200);
  })
);
