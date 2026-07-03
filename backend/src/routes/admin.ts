import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.js";
import { asyncRoute } from "../lib/asyncRoute.js";
import { getCurrentPeriod } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import { resolvePaymentStatus } from "../lib/paymentState.js";
import { prisma } from "../lib/prisma.js";
import { getSettings } from "../lib/settings.js";
import { notifyParticipant } from "../telegram/notify.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

const instrumentSchema = z.enum(["mic", "guitar", "bass", "drums", "synth", "teacher"]);
const telegramIdSchema = z.string().regex(/^\d+$/).transform((value) => BigInt(value));

const musicianCreateSchema = z.object({
  telegramId: telegramIdSchema,
  username: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1).optional(),
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

const resolveName = (musician: { fullName: string | null; username: string | null; telegramId: bigint }) =>
  musician.fullName || (musician.username ? `@${musician.username}` : musician.telegramId.toString());

adminRouter.get(
  "/dashboard",
  asyncRoute(async (req, res) => {
    const period = typeof req.query.period === "string" ? req.query.period : getCurrentPeriod();
    const settings = await getSettings();
    const musicians = await prisma.musician.findMany({
      where: { status: "active" },
      include: {
        payments: { where: { period } },
        deferralRequests: { where: { period } }
      },
      orderBy: [{ fullName: "asc" }, { username: "asc" }]
    });

    const rows = musicians.map((musician) => {
      const payment = musician.payments[0] ?? null;
      const deferral = musician.deferralRequests[0] ?? null;
      const state = resolvePaymentStatus({ musician, settings, period, payment, deferral });

      return {
        musician,
        payment,
        deferral,
        amount: payment?.amount ?? musician.monthlyPrice,
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
    const musician = await prisma.musician.update({
      where: { id: req.params.id },
      data: body
    });

    logger.info("musician_updated", {
      adminId: req.musician!.id,
      musicianId: musician.id,
      changedFields: Object.keys(body)
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

adminRouter.get(
  "/deferrals",
  asyncRoute(async (_req, res) => {
    const requests = await prisma.deferralRequest.findMany({
      include: { musician: true },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }]
    });

    res.json({ requests });
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

adminRouter.post(
  "/deferrals/:id/approve",
  asyncRoute(async (req, res) => {
    const request = await prisma.deferralRequest.update({
      where: { id: req.params.id },
      data: {
        status: "approved",
        resolvedAt: new Date(),
        adminComment: typeof req.body?.adminComment === "string" ? req.body.adminComment : null
      },
      include: { musician: true }
    });

    await prisma.payment.updateMany({
      where: {
        musicianId: request.musicianId,
        period: request.period,
        status: "overdue"
      },
      data: { status: "pending" }
    });

    await notifyParticipant(
      request.musician.telegramId,
      `Заявка на отсрочку за ${request.period} одобрена.`
    );

    logger.info("deferral_approved", {
      adminId: req.musician!.id,
      requestId: request.id,
      musicianId: request.musicianId
    });

    res.json({ request, musicianName: resolveName(request.musician) });
  })
);

adminRouter.post(
  "/deferrals/:id/reject",
  asyncRoute(async (req, res) => {
    const request = await prisma.deferralRequest.delete({
      where: { id: req.params.id },
      include: { musician: true }
    });

    await notifyParticipant(
      request.musician.telegramId,
      `Заявка на отсрочку за ${request.period} отклонена.`
    );

    logger.info("deferral_rejected", {
      adminId: req.musician!.id,
      requestId: request.id,
      musicianId: request.musicianId
    });

    res.json({
      request: {
        ...request,
        status: "rejected",
        resolvedAt: new Date(),
        adminComment: typeof req.body?.adminComment === "string" ? req.body.adminComment : null
      },
      deleted: true,
      musicianName: resolveName(request.musician)
    });
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
