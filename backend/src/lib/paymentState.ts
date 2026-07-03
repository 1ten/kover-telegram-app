import type { DeferralRequest, Musician, Payment, Settings } from "@prisma/client";
import { getPaymentDeadline } from "./dates.js";

export const resolvePaymentStatus = (input: {
  musician: Musician;
  settings: Settings;
  period: string;
  payment?: Payment | null;
  deferral?: DeferralRequest | null;
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

  // Approved deferral is a period-level extension: payment_day stays unchanged,
  // and this period is not shown as overdue until the admin changes the request.
  if (input.deferral?.status === "approved") {
    return { status: "pending" as const, dueAt, graceEndsAt, grace };
  }

  if (now > graceEndsAt) {
    return { status: "overdue" as const, dueAt, graceEndsAt, grace };
  }

  return { status: "pending" as const, dueAt, graceEndsAt, grace };
};
