export type Instrument = "mic" | "guitar" | "bass" | "drums" | "synth" | "teacher";
export type PaymentStatus = "pending" | "paid" | "overdue" | "failed";
export type DeferralStatus = "pending" | "approved" | "rejected";
export type MusicianStatus = "active" | "archived";

export type Musician = {
  id: string;
  telegramId: string;
  username: string | null;
  fullName: string | null;
  isAdmin: boolean;
  monthlyPrice: number;
  paymentDay: number;
  gracePeriodDays: number | null;
  gracePeriodHours: number | null;
  instruments: Instrument[];
  status: MusicianStatus;
};

export type Payment = {
  id: string;
  musicianId: string;
  amount: number;
  period: string;
  status: PaymentStatus;
  yookassaPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type DeferralRequest = {
  id: string;
  musicianId: string;
  period: string;
  status: DeferralStatus;
  requestedAt: string;
  resolvedAt: string | null;
  adminComment: string | null;
};

export type Settings = {
  id: string;
  defaultPaymentDay: number;
  defaultGracePeriodDays: number;
  defaultGracePeriodHours: number;
  reminderDaysBefore: number;
  reminderTime: string;
};

export type MemberSummary = {
  musician: Musician;
  period: string;
  payment: Payment | null;
  deferral: DeferralRequest | null;
  history: Payment[];
  status: PaymentStatus;
  dueAt: string;
  graceEndsAt: string;
  grace: {
    days: number;
    hours: number;
  };
};

export type DashboardRow = {
  musician: Musician;
  payment: Payment | null;
  deferral: DeferralRequest | null;
  amount: number;
  status: PaymentStatus;
  dueAt: string;
  graceEndsAt: string;
};
