type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
};

type TelegramWebApp = {
  initData: string;
  themeParams: TelegramThemeParams;
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  openLink: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export const tg = window.Telegram?.WebApp;

export const initTelegram = () => {
  tg?.ready();
  tg?.expand();

  const theme = tg?.themeParams;

  if (!theme) {
    return;
  }

  const root = document.documentElement;
  const setVar = (name: string, value?: string) => value && root.style.setProperty(name, value);

  setVar("--tg-bg", theme.bg_color);
  setVar("--tg-text", theme.text_color);
  setVar("--tg-muted", theme.hint_color);
  setVar("--tg-link", theme.link_color);
  setVar("--tg-button", theme.button_color);
  setVar("--tg-button-text", theme.button_text_color);
  setVar("--tg-surface", theme.secondary_bg_color);
};

export const getInitData = () => tg?.initData || import.meta.env.VITE_DEV_INIT_DATA || "";

export const openExternal = (url: string) => {
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }

  window.location.href = url;
};
