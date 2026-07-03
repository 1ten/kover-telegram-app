import type {
  DashboardRow,
  Instrument,
  MemberSummary,
  Musician,
  Payment,
  PaymentStatus,
  Settings
} from "./types";

type MockOptions = {
  method?: string;
  body?: unknown;
};

type MusicianDraft = {
  telegramId?: string;
  username?: string | null;
  fullName?: string | null;
  isAdmin?: boolean;
  monthlyPrice?: number;
  paymentDay?: number;
  gracePeriodDays?: number | null;
  gracePeriodHours?: number | null;
  instruments?: Instrument[];
};

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const iso = (date: Date) => date.toISOString();
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let settings: Settings = {
  id: "global",
  defaultPaymentDay: 25,
  defaultGracePeriodDays: 3,
  defaultGracePeriodHours: 0,
  reminderDaysBefore: 3,
  reminderTime: "10:00"
};

let musicians: Musician[] = [
  {
    id: "m-admin",
    telegramId: "111111111",
    username: "kover_admin",
    fullName: "Руководитель KOVER",
    isAdmin: true,
    monthlyPrice: 5000,
    paymentDay: 25,
    gracePeriodDays: null,
    gracePeriodHours: null,
    instruments: ["teacher", "mic"],
    status: "active"
  },
  {
    id: "m-vocal",
    telegramId: "222222222",
    username: "maria_vocal",
    fullName: "Мария Волкова",
    isAdmin: false,
    monthlyPrice: 5000,
    paymentDay: 25,
    gracePeriodDays: null,
    gracePeriodHours: null,
    instruments: ["mic"],
    status: "active"
  },
  {
    id: "m-guitar",
    telegramId: "333333333",
    username: "ilya_guitar",
    fullName: "Илья Кузнецов",
    isAdmin: false,
    monthlyPrice: 5500,
    paymentDay: 20,
    gracePeriodDays: 2,
    gracePeriodHours: 12,
    instruments: ["guitar", "bass"],
    status: "active"
  },
  {
    id: "m-drums",
    telegramId: "444444444",
    username: "den_drums",
    fullName: "Денис Морозов",
    isAdmin: false,
    monthlyPrice: 4800,
    paymentDay: 5,
    gracePeriodDays: null,
    gracePeriodHours: null,
    instruments: ["drums"],
    status: "active"
  },
  {
    id: "m-archived",
    telegramId: "555555555",
    username: "old_synth",
    fullName: "Архивный участник",
    isAdmin: false,
    monthlyPrice: 4500,
    paymentDay: 25,
    gracePeriodDays: null,
    gracePeriodHours: null,
    instruments: ["synth"],
    status: "archived"
  }
];

let payments: Payment[] = [
  {
    id: "p-admin-prev",
    musicianId: "m-admin",
    amount: 5000,
    period: "2026-06",
    status: "paid",
    yookassaPaymentId: "demo-admin-prev",
    createdAt: "2026-06-20T10:15:00.000Z",
    paidAt: "2026-06-20T10:16:00.000Z"
  },
  {
    id: "p-vocal-current",
    musicianId: "m-vocal",
    amount: 5000,
    period: currentPeriod(),
    status: "paid",
    yookassaPaymentId: "demo-vocal-current",
    createdAt: iso(new Date()),
    paidAt: iso(new Date())
  },
  {
    id: "p-drums-current",
    musicianId: "m-drums",
    amount: 4800,
    period: currentPeriod(),
    status: "overdue",
    yookassaPaymentId: "demo-drums-current",
    createdAt: iso(new Date()),
    paidAt: null
  }
];

const currentMusicianId = "m-admin";

const asDateParts = (period: string) => {
  const [yearRaw, monthRaw] = period.split("-");
  return { year: Number(yearRaw), month: Number(monthRaw) };
};

const dueAt = (musician: Musician, period: string) => {
  const { year, month } = asDateParts(period);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(musician.paymentDay, 1), lastDay);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
};

const deadline = (musician: Musician, period: string) => {
  const due = dueAt(musician, period);
  const graceEndsAt = new Date(due);
  const days = musician.gracePeriodDays ?? settings.defaultGracePeriodDays;
  const hours = musician.gracePeriodHours ?? settings.defaultGracePeriodHours;
  graceEndsAt.setDate(graceEndsAt.getDate() + days);
  graceEndsAt.setHours(graceEndsAt.getHours() + hours);

  return {
    dueAt: iso(due),
    graceEndsAt: iso(graceEndsAt),
    grace: { days, hours }
  };
};

const resolveStatus = (musician: Musician, period: string, payment?: Payment): PaymentStatus => {
  if (payment?.status === "paid") return "paid";
  if (payment?.status === "failed") return "failed";
  if (payment?.status === "overdue") return "overdue";
  return new Date() > new Date(deadline(musician, period).graceEndsAt) ? "overdue" : "pending";
};

const getPaymentAmount = (musician: Musician, payment?: Payment | null) =>
  payment?.status === "paid" ? payment.amount : musician.monthlyPrice;

const findMusician = (id: string) => {
  const musician = musicians.find((item) => item.id === id);

  if (!musician) {
    throw new Error("Демо-участник не найден");
  }

  return musician;
};

const buildSummary = (musicianId = currentMusicianId, period = currentPeriod()): MemberSummary => {
  const musician = findMusician(musicianId);
  const payment = payments.find((item) => item.musicianId === musician.id && item.period === period) ?? null;
  const dates = deadline(musician, period);

  return {
    musician,
    period,
    payment,
    amount: getPaymentAmount(musician, payment),
    history: payments
      .filter((item) => item.musicianId === musician.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    status: resolveStatus(musician, period, payment ?? undefined),
    ...dates
  };
};

const buildDashboard = (period: string): DashboardRow[] =>
  musicians
    .filter((musician) => musician.status === "active")
    .map((musician) => {
      const payment = payments.find((item) => item.musicianId === musician.id && item.period === period) ?? null;
      const dates = deadline(musician, period);

      return {
        musician,
        payment,
        amount: getPaymentAmount(musician, payment),
        status: resolveStatus(musician, period, payment ?? undefined),
        dueAt: dates.dueAt,
        graceEndsAt: dates.graceEndsAt
      };
    });

const upsertCurrentPayment = (period: string) => {
  const musician = findMusician(currentMusicianId);
  const existing = payments.find(
    (payment) => payment.musicianId === currentMusicianId && payment.period === period
  );

  if (existing) {
    existing.status = "paid";
    existing.amount = musician.monthlyPrice;
    existing.paidAt = iso(new Date());
    return existing;
  }

  const payment: Payment = {
    id: newId("p"),
    musicianId: currentMusicianId,
    amount: musician.monthlyPrice,
    period,
    status: "paid",
    yookassaPaymentId: newId("demo-yookassa"),
    createdAt: iso(new Date()),
    paidAt: iso(new Date())
  };
  payments = [payment, ...payments];
  return payment;
};

const createMusician = (draft: MusicianDraft) => {
  const musician: Musician = {
    id: newId("m"),
    telegramId: draft.telegramId ?? String(Date.now()),
    username: draft.username || null,
    fullName: draft.fullName || null,
    isAdmin: draft.isAdmin ?? false,
    monthlyPrice: draft.monthlyPrice ?? 5000,
    paymentDay: draft.paymentDay ?? settings.defaultPaymentDay,
    gracePeriodDays: draft.gracePeriodDays ?? null,
    gracePeriodHours: draft.gracePeriodHours ?? null,
    instruments: draft.instruments ?? [],
    status: "active"
  };
  musicians = [musician, ...musicians];
  return musician;
};

const updateMusician = (id: string, draft: MusicianDraft & Partial<Pick<Musician, "status">>) => {
  const index = musicians.findIndex((musician) => musician.id === id);

  if (index === -1) {
    throw new Error("Демо-участник не найден");
  }

  const next = { ...musicians[index], ...draft } as Musician;
  musicians = musicians.map((musician) => (musician.id === id ? next : musician));

  if (draft.monthlyPrice !== undefined) {
    const period = currentPeriod();
    payments = payments.map((payment) =>
      payment.musicianId === id && payment.period === period && payment.status !== "paid"
        ? { ...payment, amount: next.monthlyPrice }
        : payment
    );
  }

  return next;
};

export const demoApi = async <T>(path: string, options: MockOptions = {}): Promise<T> => {
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  const url = new URL(path, "https://demo.kover.local");
  const method = (options.method ?? "GET").toUpperCase();
  const body = (options.body ?? {}) as Record<string, unknown>;
  const period =
    typeof body.period === "string"
      ? body.period
      : url.searchParams.get("period") ?? currentPeriod();

  if (url.pathname === "/api/me") {
    return clone({ musician: findMusician(currentMusicianId) }) as T;
  }

  if (url.pathname === "/api/me/summary") {
    return clone(buildSummary(currentMusicianId, period)) as T;
  }

  if (url.pathname === "/api/payments" && method === "GET") {
    return clone({
      payments: payments.filter((payment) => payment.musicianId === currentMusicianId)
    }) as T;
  }

  if (url.pathname === "/api/payments" && method === "POST") {
    return clone({
      payment: upsertCurrentPayment(period),
      demoPaid: true
    }) as T;
  }

  if (url.pathname === "/api/admin/dashboard") {
    return clone({ period, rows: buildDashboard(period) }) as T;
  }

  if (url.pathname === "/api/admin/musicians" && method === "GET") {
    return clone({ musicians }) as T;
  }

  if (url.pathname === "/api/admin/musicians" && method === "POST") {
    return clone({ musician: createMusician(body as MusicianDraft) }) as T;
  }

  const musicianPatch = url.pathname.match(/^\/api\/admin\/musicians\/([^/]+)$/);
  if (musicianPatch && method === "PATCH") {
    return clone({ musician: updateMusician(musicianPatch[1]!, body as MusicianDraft) }) as T;
  }

  if (musicianPatch && method === "DELETE") {
    return clone({ musician: updateMusician(musicianPatch[1]!, { status: "archived" }) }) as T;
  }

  if (url.pathname === "/api/admin/settings" && method === "GET") {
    return clone({ settings }) as T;
  }

  if (url.pathname === "/api/admin/settings" && method === "PATCH") {
    settings = { ...settings, ...body };
    return clone({ settings }) as T;
  }

  if (url.pathname === "/api/admin/settings/test-payment-reminder" && method === "POST") {
    return clone({ sent: musicians.filter((musician) => musician.status === "active").length }) as T;
  }

  throw new Error(`Demo API route is not implemented: ${method} ${url.pathname}`);
};
