import { getInitData } from "./telegram";
import { demoApi } from "./mockApi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export const api = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const initData = getInitData();
  const forceDemo = import.meta.env.VITE_DEMO_MODE === "true";

  if (forceDemo) {
    return demoApi<T>(path, options);
  }

  if (!initData) {
    throw new Error("Открой приложение через Telegram-бота. В обычном браузере реальный режим не может определить пользователя.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `tma ${initData}`,
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Ошибка запроса");
  }

  return payload as T;
};
