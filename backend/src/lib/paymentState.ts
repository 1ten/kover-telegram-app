import type { Musician, Payment, Settings } from "@prisma/client";
import { getPaymentDeadline } from "./dates.js";

export const getPaymentAmount = (musician: Musician, payment?: Payment | null) =>
  payment?.status === "paid" ? payment.amount : musician.monthlyPrice;

export const resolvePaymentStatus = (input: {
  musician: Musician;
  settings: Settings;
  period: string;
  payment?: Payment | null;
  now?: Date;
}) => {
  const now = input.now ?? new Date();
  const { dueAt, graceEndsAt, grace } = getPaymentDeadline(
    input.musician,
    input.settings,
    input.period
  );

  if (input.payment?.status === "paid") {
    return { status: "paid" as const, dueAt, graceEndsAt, grace };
  }

  if (input.payment?.status === "failed") {
    return { status: "failed" as const, dueAt, graceEndsAt, grace };
  }

  if (now > graceEndsAt) {
    return { status: "overdue" as const, dueAt, graceEndsAt, grace };
  }

  return { status: "pending" as const, dueAt, graceEndsAt, grace };
};
