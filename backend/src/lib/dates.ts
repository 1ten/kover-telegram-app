import type { Musician, Settings } from "@prisma/client";

const pad = (value: number) => value.toString().padStart(2, "0");

export const getCurrentPeriod = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const getMonthBounds = (period: string) => {
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid period: ${period}`);
  }

  const firstDay = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month, 0, 23, 59, 59, 999);

  return { year, month, firstDay, lastDay };
};

export const getPaymentDueDate = (period: string, paymentDay: number) => {
  const { year, month } = getMonthBounds(period);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(Math.max(paymentDay, 1), lastDayOfMonth);

  return new Date(year, month - 1, safeDay, 23, 59, 59, 999);
};

export const getGraceConfig = (musician: Musician, settings: Settings) => ({
  days: musician.gracePeriodDays ?? settings.defaultGracePeriodDays,
  hours: musician.gracePeriodHours ?? settings.defaultGracePeriodHours
});

export const getPaymentDeadline = (musician: Musician, settings: Settings, period: string) => {
  const dueAt = getPaymentDueDate(period, musician.paymentDay);
  const grace = getGraceConfig(musician, settings);
  const graceEndsAt = new Date(dueAt);
  graceEndsAt.setDate(graceEndsAt.getDate() + grace.days);
  graceEndsAt.setHours(graceEndsAt.getHours() + grace.hours);

  return { dueAt, graceEndsAt, grace };
};

export const isSameLocalDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();
