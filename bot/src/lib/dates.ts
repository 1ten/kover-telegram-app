import type { Musician, Settings } from "@prisma/client";

const pad = (value: number) => value.toString().padStart(2, "0");

export const getCurrentPeriod = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const getPaymentDueDate = (period: string, paymentDay: number) => {
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(paymentDay, 1), lastDayOfMonth);

  return new Date(year, month - 1, day, 23, 59, 59, 999);
};

export const getPaymentDeadline = (musician: Musician, settings: Settings, period: string) => {
  const dueAt = getPaymentDueDate(period, musician.paymentDay);
  const graceEndsAt = new Date(dueAt);
  graceEndsAt.setDate(graceEndsAt.getDate() + (musician.gracePeriodDays ?? settings.defaultGracePeriodDays));
  graceEndsAt.setHours(
    graceEndsAt.getHours() + (musician.gracePeriodHours ?? settings.defaultGracePeriodHours)
  );

  return { dueAt, graceEndsAt };
};

export const isSameLocalDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const hhmm = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
