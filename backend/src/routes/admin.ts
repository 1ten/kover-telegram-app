import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.js";
import { asyncRoute } from "../lib/asyncRoute.js";
import { getCurrentPeriod } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import { getPaymentAmount, resolvePaymentStatus } from "../lib/paymentState.js";
import { prisma } from "../lib/prisma.js";
import { getSettings } from "../lib/settings.js";
import { notifyParticipant } from "../telegram/notify.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

const instrumentSchema = z.enum(["mic", "guitar", "bass", "drums", "synth", "teacher"]);
const telegramIdSchema = z.string().regex(/^\d+$/).transform((value) => BigInt(value));
const optionalNameSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().min(1).nullable().optional()
);

const musicianCreateSchema = z.object({
  telegramId: telegramIdSchema,
  username: optionalNameSchema,
  fullName: optionalNameSchema,
  isAdmin: z.boolean().optional(),
  monthlyPrice: z.coerce.number().int().positive().default(5000),
  paymentDay: z.coerce.number().int().min(1).max(31).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).nullable().optional(),
  gracePeriodHours: z.coerce.number().int().min(0).nullable().optional(),
  instruments: z.array(instrumentSchema).default([])
});

const musicianUpdateSchema = musicianCreateSchema
  .omit({ telegramId: true })
  .partial()
  .extend({
    status: z.enum(["active", "archived"]).optional()
  });

const settingsUpdateSchema = z.object({
  defaultPaymentDay: z.coerce.number().int().min(1).max(31).optional(),
  defaultGracePeriodDays: z.coerce.number().int().min(0).optional(),
  defaultGracePeriodHours: z.coerce.number().int().min(0).optional(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(31).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

const manualPaymentSchema = z.object({
  musicianId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  status: z.enum(["paid", "pending", "failed"]).default("paid")
});

adminRouter.get(
  "/dashboard",
  asyncRoute(async (req, res) => {
    const period = typeof req.query.period === "string" ? req.query.period : getCurrentPeriod();
    const settings = await getSettings();
    const musicians = await prisma.musician.findMany({
      where: { status: "active" },
      include: {
        payments: { where: { period } }
      },
      orderBy: [{ fullName: "asc" }, { username: "asc" }]
    });

    const rows = musicians.map((musician) => {
      const payment = musician.payments[0] ?? null;
      const state = resolvePaymentStatus({ musician, settings, period, payment });

      return {
        musician,
        payment,
        amount: getPaymentAmount(musician, payment),
        ...state
      };
    });

    res.json({ period, rows });
  })
);

adminRouter.get(
  "/musicians",
  asyncRoute(async (_req, res) => {
    const musicians = await prisma.musician.findMany({
      orderBy: [{ status: "asc" }, { fullName: "asc" }, { username: "asc" }]
    });

    res.json({ musicians });
  })
);

adminRouter.post(
  "/musicians",
  asyncRoute(async (req, res) => {
    const body = musicianCreateSchema.parse(req.body);
    const settings = await getSettings();
    const musician = await prisma.musician.create({
      data: {
        telegramId: body.telegramId,
        username: body.username,
        fullName: body.fullName,
        isAdmin: body.isAdmin ?? false,
        monthlyPrice: body.monthlyPrice,
        paymentDay: body.paymentDay ?? settings.defaultPaymentDay,
        gracePeriodDays: body.gracePeriodDays,
        gracePeriodHours: body.gracePeriodHours,
        instruments: body.instruments,
        status: "active"
      }
    });

    logger.info("musician_created", {
      adminId: req.musician!.id,
      musicianId: musician.id
    });

    res.status(201).json({ musician });
  })
);

adminRouter.patch(
  "/musicians/:id",
  asyncRoute(async (req, res) => {
    const body = musicianUpdateSchema.parse(req.body);
    const period = getCurrentPeriod();
    const { musician, syncedCurrentPayments } = await prisma.$transaction(async (tx) => {
      const musician = await tx.musician.update({
        where: { id: req.params.id },
        data: body
      });

      if (body.monthlyPrice === undefined) {
        return { musician, syncedCurrentPayments: 0 };
      }

      const result = await tx.payment.updateMany({
        where: {
          musicianId: musician.id,
          period,
          status: { not: "paid" }
        },
        data: { amount: musician.monthlyPrice }
      });

      return { musician, syncedCurrentPayments: result.count };
    });

    logger.info("musician_updated", {
      adminId: req.musician!.id,
      musicianId: musician.id,
      changedFields: Object.keys(body),
      syncedCurrentPayments
    });

    res.json({ musician });
  })
);

adminRouter.delete(
  "/musicians/:id",
  asyncRoute(async (req, res) => {
    const musician = await prisma.musician.update({
      where: { id: req.params.id },
      data: { status: "archived" }
    });

    logger.info("musician_archived", {
      adminId: req.musician!.id,
      musicianId: musician.id
    });

    res.json({ musician });
  })
);

adminRouter.post(
  "/payments/manual-status",
  asyncRoute(async (req, res) => {
    const body = manualPaymentSchema.parse(req.body);
    const musician = await prisma.musician.findUniqueOrThrow({
      where: { id: body.musicianId }
    });

    const payment = await prisma.payment.upsert({
      where: {
        musicianId_period: {
          musicianId: musician.id,
          period: body.period
        }
      },
      create: {
        musicianId: musician.id,
        period: body.period,
        amount: musician.monthlyPrice,
        status: body.status,
        paidAt: body.status === "paid" ? new Date() : null
      },
      update: {
        amount: musician.monthlyPrice,
        status: body.status,
        paidAt: body.status === "paid" ? new Date() : null
      }
    });

    logger.info("manual_payment_status_updated", {
      adminId: req.musician!.id,
      musicianId: musician.id,
      paymentId: payment.id,
      period: payment.period,
      status: payment.status
    });

    if (body.status === "paid") {
      await notifyParticipant(musician.telegramId, `Оплата за ${body.period} отмечена как полученная.`);
    }

    res.json({ payment });
  })
);

adminRouter.get(
  "/settings",
  asyncRoute(async (_req, res) => {
    res.json({ settings: await getSettings() });
  })
);

adminRouter.patch(
  "/settings",
  asyncRoute(async (req, res) => {
    const body = settingsUpdateSchema.parse(req.body);
    const settings = await prisma.settings.update({
      where: { id: "global" },
      data: body
    });

    logger.info("settings_updated", {
      adminId: req.musician!.id,
      changedFields: Object.keys(body)
    });

    res.json({ settings });
  })
);

adminRouter.post(
  "/settings/test-payment-reminder",
  asyncRoute(async (req, res) => {
    const period = getCurrentPeriod();
    const musicians = await prisma.musician.findMany({
      where: { status: "active" },
      select: {
        id: true,
        telegramId: true
      }
    });

    await Promise.all(
      musicians.map((musician) =>
        notifyParticipant(
          musician.telegramId,
          `Тестовое оповещение KOVER: пора оплатить репетиции за ${period}. Открой приложение и нажми «Оплатить».`
        )
      )
    );

    logger.info("test_payment_reminder_sent", {
      adminId: req.musician!.id,
      period,
      count: musicians.length
    });

    res.json({ sent: musicians.length, period });
  })
);
