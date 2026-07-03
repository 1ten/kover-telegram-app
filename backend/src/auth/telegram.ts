import crypto from "node:crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type TelegramAuthResult = {
  user: TelegramWebAppUser;
  authDate: Date;
};

const timingSafeEqualHex = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const validateTelegramInitData = (
  initData: string,
  botToken: string,
  ttlSeconds: number
): TelegramAuthResult => {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");

  if (!hash || !authDateRaw || !userRaw) {
    throw new Error("Telegram initData is missing required fields");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqualHex(expectedHash, hash)) {
    throw new Error("Telegram initData hash is invalid");
  }

  const authDate = new Date(Number(authDateRaw) * 1000);
  const ageSeconds = Math.floor((Date.now() - authDate.getTime()) / 1000);

  if (ageSeconds > ttlSeconds) {
    throw new Error("Telegram initData is expired");
  }

  return {
    user: JSON.parse(userRaw) as TelegramWebAppUser,
    authDate
  };
};
