import crypto from "node:crypto";
import { env } from "../config/env.js";
import type {
  CreatedPayment,
  CreatePaymentInput,
  PaymentProvider,
  PaymentWebhookResult,
  ProviderPaymentStatus
} from "./paymentProvider.js";

type YooKassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  confirmation?: {
    confirmation_url?: string;
  };
};

const toProviderStatus = (status: YooKassaPayment["status"]): ProviderPaymentStatus["status"] => {
  if (status === "succeeded") return "succeeded";
  if (status === "canceled") return "canceled";
  return "pending";
};

export class YooKassaProvider implements PaymentProvider {
  private readonly baseUrl = "https://api.yookassa.ru/v3";
  private readonly authHeader = `Basic ${Buffer.from(
    `${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`
  ).toString("base64")}`;

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    if (!input.returnUrl) {
      throw new Error("YOOKASSA_RETURN_URL is required for YooKassa payments");
    }

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        amount: {
          value: input.amount.toFixed(2),
          currency: "RUB"
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: input.returnUrl
        },
        description: input.description,
        metadata: input.metadata
      })
    });

    if (!response.ok) {
      throw new Error(`YooKassa createPayment failed: ${response.status} ${await response.text()}`);
    }

    const payment = (await response.json()) as YooKassaPayment;
    const confirmationUrl = payment.confirmation?.confirmation_url;

    if (!confirmationUrl) {
      throw new Error("YooKassa payment has no confirmation_url");
    }

    return {
      providerPaymentId: payment.id,
      status: payment.status,
      confirmationUrl
    };
  }

  async handleWebhook(payload: unknown): Promise<PaymentWebhookResult> {
    const event = payload as { event?: string; object?: { id?: string } };

    if (!event.event || !event.object?.id) {
      throw new Error("YooKassa webhook payload is invalid");
    }

    return {
      event: event.event,
      providerPaymentId: event.object.id
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const response = await fetch(`${this.baseUrl}/payments/${providerPaymentId}`, {
      headers: {
        Authorization: this.authHeader
      }
    });

    if (!response.ok) {
      throw new Error(`YooKassa getPaymentStatus failed: ${response.status} ${await response.text()}`);
    }

    const payment = (await response.json()) as YooKassaPayment;

    return {
      providerPaymentId: payment.id,
      status: toProviderStatus(payment.status)
    };
  }
}
