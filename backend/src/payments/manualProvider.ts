import type {
  CreatedPayment,
  CreatePaymentInput,
  PaymentProvider,
  PaymentWebhookResult,
  ProviderPaymentStatus
} from "./paymentProvider.js";

export class ManualPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    return {
      providerPaymentId: `manual_${input.metadata.paymentId}`,
      status: "pending"
    };
  }

  async handleWebhook(_payload: unknown): Promise<PaymentWebhookResult> {
    throw new Error("Manual payment mode does not support webhooks");
  }

  async getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return {
      providerPaymentId,
      status: "pending"
    };
  }
}
