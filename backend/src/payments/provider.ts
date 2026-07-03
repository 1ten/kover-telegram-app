import { env } from "../config/env.js";
import { ManualPaymentProvider } from "./manualProvider.js";
import type { PaymentProvider } from "./paymentProvider.js";
import { YooKassaProvider } from "./yookassaProvider.js";

export const paymentProvider: PaymentProvider =
  env.PAYMENT_PROVIDER === "yookassa" ? new YooKassaProvider() : new ManualPaymentProvider();
