export type CreatePaymentInput = {
  amount: number;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
};

export type CreatedPayment = {
  providerPaymentId: string;
  status: string;
  confirmationUrl: string;
};

export type ProviderPaymentStatus = {
  providerPaymentId: string;
  status: "pending" | "succeeded" | "canceled" | "failed";
};

export type PaymentWebhookResult = {
  event: string;
  providerPaymentId: string;
};

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  handleWebhook(payload: unknown): Promise<PaymentWebhookResult>;
  getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus>;
}
