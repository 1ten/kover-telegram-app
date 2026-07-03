import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  Drum,
  GraduationCap,
  Guitar,
  History,
  Mic,
  Music,
  RefreshCw,
  Save,
  Settings,
  SlidersHorizontal,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { api } from "./api";
import { getTelegramDebugInfo } from "./telegram";
import type {
  DashboardRow,
  Instrument,
  MemberSummary,
  Musician,
  Settings as AppSettings
} from "./types";

type RoleMode = "member" | "admin";
type MemberTab = "pay" | "history" | "profile";
type AdminTab = "dashboard" | "members" | "settings";
const MIN_LOADING_MS = 1800;

type NavItem<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
};

const instrumentLabels: Record<Instrument, string> = {
  mic: "Вокал",
  guitar: "Гитара",
  bass: "Бас",
  drums: "Барабаны",
  synth: "Синтезатор",
  teacher: "Преподаватель"
};

const instrumentOrder: Instrument[] = ["mic", "guitar", "bass", "drums", "synth", "teacher"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value))
    : "—";

const displayName = (musician: Musician) =>
  musician.fullName || (musician.username ? `@${musician.username}` : musician.telegramId);

const statusCopy = {
  paid: "Оплачено",
  pending: "Не оплачено",
  overdue: "Просрочено",
  failed: "Ошибка"
};

function KoverMark() {
  return (
    <div className="kover-mark" aria-hidden="true">
      <span className="kover-burst" />
      <span className="kover-word">KOVER</span>
    </div>
  );
}

function BassIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.8 3.2 21 8.4l-1.5 1.5-1.3-1.3-4.5 4.5c1 2 .7 4.5-1 6.2-2.1 2.1-5.5 2.1-7.6 0s-2.1-5.5 0-7.6c1.7-1.7 4.2-2.1 6.2-1l4.5-4.5-1.4-1.4 1.4-1.6Z"
        fill="currentColor"
        opacity=".92"
      />
      <circle cx="8.8" cy="15.9" r="1.4" fill="var(--surface)" />
    </svg>
  );
}

function InstrumentIcon({ instrument }: { instrument: Instrument }) {
  if (instrument === "mic") return <Mic size={18} />;
  if (instrument === "guitar") return <Guitar size={18} />;
  if (instrument === "bass") return <BassIcon />;
  if (instrument === "drums") return <Drum size={18} />;
  if (instrument === "synth") return <Music size={18} />;
  return <GraduationCap size={18} />;
}

function StatusBadge({ status }: { status: keyof typeof statusCopy }) {
  return <span className={`status-badge ${status}`}>{statusCopy[status]}</span>;
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="avatar-loader" aria-hidden="true">
        <span className="avatar-loader-ring" />
        <span className="avatar-loader-medallion" />
        <span className="avatar-loader-glint" />
      </div>
      <p>твой любимый музыкальный проект</p>
    </main>
  );
}

function RoleToggle({
  mode,
  onChange
}: {
  mode: RoleMode;
  onChange: (mode: RoleMode) => void;
}) {
  const options: NavItem<RoleMode>[] = [
    { value: "member", label: "Участник", icon: <CreditCard size={18} /> },
    { value: "admin", label: "Админ", icon: <SlidersHorizontal size={18} /> }
  ];

  return (
    <div className="role-toggle" role="group" aria-label="Режим приложения">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={mode === option.value ? "role-option active" : "role-option"}
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className="control-icon">{option.icon}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function NavDock<T extends string>({
  items,
  value,
  onChange,
  variant
}: {
  items: NavItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant: "member" | "admin";
}) {
  return (
    <nav className={`nav-dock ${variant}-dock`} aria-label="Разделы">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={value === item.value ? "nav-card active" : "nav-card"}
          aria-current={value === item.value ? "page" : undefined}
          onClick={() => onChange(item.value)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function InstrumentPicker({
  value,
  onChange
}: {
  value: Instrument[];
  onChange: (value: Instrument[]) => void;
}) {
  const toggle = (instrument: Instrument) => {
    onChange(
      value.includes(instrument)
        ? value.filter((item) => item !== instrument)
        : [...value, instrument]
    );
  };

  return (
    <div className="instrument-picker">
      {instrumentOrder.map((instrument) => (
        <button
          key={instrument}
          type="button"
          className={value.includes(instrument) ? "chip selected" : "chip"}
          onClick={() => toggle(instrument)}
          title={instrumentLabels[instrument]}
        >
          <InstrumentIcon instrument={instrument} />
          <span>{instrumentLabels[instrument]}</span>
        </button>
      ))}
    </div>
  );
}

function useRemaining(target: string) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const diff = Math.max(new Date(target).getTime() - now, 0);
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    return `${days} дн. ${hours} ч.`;
  }, [now, target]);
}

export function App() {
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [mode, setMode] = useState<RoleMode>("member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (options: { preferAdmin?: boolean } = {}) => {
    setError(null);
    const result = await api<MemberSummary>("/api/me/summary");
    setSummary(result);
    if (options.preferAdmin && result.musician.isAdmin) {
      setMode("admin");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const startedAt = Date.now();

    loadSummary({ preferAdmin: true })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(MIN_LOADING_MS - elapsed, 0);

        timeoutId = window.setTimeout(() => {
          if (!cancelled) {
            setLoading(false);
          }
        }, wait);
      });

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadSummary]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !summary) {
    const debugInfo = getTelegramDebugInfo();

    return (
      <main className="screen-state error-state">
        <p>{error || "Не удалось открыть приложение"}</p>
        <pre className="debug-box">{JSON.stringify(debugInfo, null, 2)}</pre>
        <button className="primary-button" onClick={() => window.location.reload()}>
          <RefreshCw size={18} />
          Обновить
        </button>
      </main>
    );
  }

  const isAdmin = summary.musician.isAdmin;

  return (
    <main className={`app-shell ${mode === "admin" && isAdmin ? "admin-shell" : "member-shell"}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <KoverMark />
          <div>
            <p className="eyebrow">репетиционный взнос</p>
            <h1>{mode === "admin" ? "Руководитель" : displayName(summary.musician)}</h1>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="hero-rug" />
          <span className="hero-vinyl" />
          <span className="hero-play">
            <Music size={28} />
          </span>
        </div>
        {isAdmin && (
          <RoleToggle
            mode={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              if (nextMode === "member") {
                loadSummary().catch(console.error);
              }
            }}
          />
        )}
      </header>

      {mode === "admin" && isAdmin ? (
        <AdminApp onDataChange={loadSummary} />
      ) : (
        <MemberApp summary={summary} refresh={loadSummary} />
      )}
    </main>
  );
}

function MemberApp({ summary, refresh }: { summary: MemberSummary; refresh: () => Promise<void> }) {
  const [tab, setTab] = useState<MemberTab>("pay");
  const items: NavItem<MemberTab>[] = [
    { value: "pay", label: "Оплата", icon: <CreditCard size={19} /> },
    { value: "history", label: "История", icon: <History size={19} /> },
    { value: "profile", label: "Профиль", icon: <Users size={19} /> }
  ];

  return (
    <>
      <NavDock items={items} value={tab} onChange={setTab} variant="member" />

      {tab === "pay" && <PaymentPanel summary={summary} refresh={refresh} />}
      {tab === "history" && <HistoryPanel summary={summary} />}
      {tab === "profile" && <ProfilePanel musician={summary.musician} summary={summary} />}
    </>
  );
}

function PaymentPanel({ summary, refresh }: { summary: MemberSummary; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const remaining = useRemaining(summary.graceEndsAt);

  const pay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{
        payment?: unknown;
        alreadyPaid?: boolean;
      }>("/api/payments", {
        method: "POST",
        body: { period: summary.period }
      });
      setMessage(result.alreadyPaid ? "Оплата уже была отмечена." : "Оплата отмечена. Она появится в истории и админ-панели.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel payment-panel">
      <div className="payment-hero">
        <div>
          <p className="eyebrow">Период {summary.period}</p>
          <h2>{formatCurrency(summary.amount)}</h2>
        </div>
        <StatusBadge status={summary.status} />
      </div>

      <div className="metric-grid">
        <div className="metric">
          <CalendarDays size={19} />
          <span>Дата оплаты</span>
          <strong>{formatDateTime(summary.dueAt)}</strong>
        </div>
        <div className="metric">
          <Clock size={19} />
          <span>До конца льготы</span>
          <strong>{remaining}</strong>
        </div>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={pay} disabled={busy || summary.status === "paid"}>
          <CreditCard size={18} />
          Оплатить
        </button>
      </div>

      {message && <div className="notice">{message}</div>}
    </section>
  );
}

function HistoryPanel({ summary }: { summary: MemberSummary }) {
  return (
    <section className="panel">
      <div className="section-title">
        <History size={19} />
        <h2>История платежей</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Период</th>
              <th>Сумма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {summary.history.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
                <td>{payment.period}</td>
                <td>{formatCurrency(payment.amount)}</td>
                <td>
                  <StatusBadge status={payment.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfilePanel({ musician, summary }: { musician: Musician; summary: MemberSummary }) {
  return (
    <section className="panel">
      <div className="section-title">
        <Users size={19} />
        <h2>Профиль</h2>
      </div>
      <div className="profile-grid">
        <div>
          <span>Цена</span>
          <strong>{formatCurrency(musician.monthlyPrice)}</strong>
        </div>
        <div>
          <span>Ближайшая дата</span>
          <strong>{formatDateTime(summary.dueAt)}</strong>
        </div>
        <div>
          <span>Льготный период</span>
          <strong>
            {summary.grace.days} дн. {summary.grace.hours} ч.
          </strong>
        </div>
      </div>
      <div className="instrument-list">
        {musician.instruments.map((instrument) => (
          <span key={instrument} className="instrument-pill">
            <InstrumentIcon instrument={instrument} />
            {instrumentLabels[instrument]}
          </span>
        ))}
      </div>
    </section>
  );
}

function AdminApp({ onDataChange }: { onDataChange: () => Promise<void> }) {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const items: NavItem<AdminTab>[] = [
    { value: "dashboard", label: "Оплаты", icon: <CalendarDays size={19} /> },
    { value: "members", label: "Участники", icon: <Users size={19} /> },
    { value: "settings", label: "Настройки", icon: <Settings size={19} /> }
  ];

  return (
    <>
      <NavDock items={items} value={tab} onChange={setTab} variant="admin" />

      {tab === "dashboard" && <AdminDashboard onDataChange={onDataChange} />}
      {tab === "members" && <AdminMembers onDataChange={onDataChange} />}
      {tab === "settings" && <AdminSettings onDataChange={onDataChange} />}
    </>
  );
}

function AdminDashboard({ onDataChange }: { onDataChange: () => Promise<void> }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api<{ rows: DashboardRow[] }>(`/api/admin/dashboard?period=${period}`);
    setRows(result.rows);
  }, [period]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const setPaymentStatus = async (musicianId: string, status: "paid" | "pending") => {
    setBusyId(musicianId);
    try {
      await api("/api/admin/payments/manual-status", {
        method: "POST",
        body: {
          musicianId,
          period,
          status
        }
      });
      await load();
      await onDataChange();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel">
      <div className="toolbar">
        <div className="section-title">
          <CalendarDays size={19} />
          <h2>Дашборд оплат</h2>
        </div>
        <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Участник</th>
              <th>Инструменты</th>
              <th>Статус</th>
              <th>Сумма</th>
              <th>Дедлайн</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.musician.id} className={row.status === "overdue" ? "danger-row" : ""}>
                <td>{displayName(row.musician)}</td>
                <td>
                  <div className="mini-instruments">
                    {row.musician.instruments.map((instrument) => (
                      <span key={instrument} title={instrumentLabels[instrument]}>
                        <InstrumentIcon instrument={instrument} />
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>{formatCurrency(row.amount)}</td>
                <td>{formatDateTime(row.graceEndsAt)}</td>
                <td>
                  <div className="icon-actions">
                    {row.status === "paid" ? (
                      <button
                        title="Вернуть в не оплачено"
                        onClick={() => setPaymentStatus(row.musician.id, "pending")}
                        disabled={busyId === row.musician.id}
                      >
                        <X size={18} />
                      </button>
                    ) : (
                      <button
                        title="Отметить оплачено"
                        onClick={() => setPaymentStatus(row.musician.id, "paid")}
                        disabled={busyId === row.musician.id}
                      >
                        <Check size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminMembers({ onDataChange }: { onDataChange: () => Promise<void> }) {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [draft, setDraft] = useState({
    telegramId: "",
    fullName: "",
    username: "",
    monthlyPrice: 5000,
    paymentDay: 25,
    instruments: [] as Instrument[]
  });

  const load = useCallback(async () => {
    const result = await api<{ musicians: Musician[] }>("/api/admin/musicians");
    setMusicians(result.musicians);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const create = async () => {
    await api("/api/admin/musicians", {
      method: "POST",
      body: draft
    });
    setDraft({
      telegramId: "",
      fullName: "",
      username: "",
      monthlyPrice: 5000,
      paymentDay: 25,
      instruments: []
    });
    await load();
    await onDataChange();
  };

  const refreshAfterMemberChange = async () => {
    await load();
    await onDataChange();
  };

  return (
    <section className="panel">
      <div className="section-title">
        <UserPlus size={19} />
        <h2>Участники</h2>
      </div>
      <div className="member-form">
        <input
          placeholder="Telegram ID"
          value={draft.telegramId}
          onChange={(event) => setDraft({ ...draft, telegramId: event.target.value })}
        />
        <input
          placeholder="Имя"
          value={draft.fullName}
          onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
        />
        <input
          placeholder="username"
          value={draft.username}
          onChange={(event) => setDraft({ ...draft, username: event.target.value })}
        />
        <input
          type="number"
          value={draft.monthlyPrice}
          onChange={(event) => setDraft({ ...draft, monthlyPrice: Number(event.target.value) })}
        />
        <input
          type="number"
          min={1}
          max={31}
          value={draft.paymentDay}
          onChange={(event) => setDraft({ ...draft, paymentDay: Number(event.target.value) })}
        />
        <InstrumentPicker
          value={draft.instruments}
          onChange={(instruments) => setDraft({ ...draft, instruments })}
        />
        <button className="primary-button" onClick={create} disabled={!draft.telegramId}>
          <UserPlus size={18} />
          Добавить
        </button>
      </div>
      <div className="member-list">
        {musicians.map((musician) => (
          <MemberEditor key={musician.id} musician={musician} onSaved={refreshAfterMemberChange} />
        ))}
      </div>
    </section>
  );
}

function MemberEditor({ musician, onSaved }: { musician: Musician; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    monthlyPrice: musician.monthlyPrice,
    paymentDay: musician.paymentDay,
    gracePeriodDays: musician.gracePeriodDays,
    gracePeriodHours: musician.gracePeriodHours,
    instruments: musician.instruments,
    status: musician.status
  });

  const save = async () => {
    await api(`/api/admin/musicians/${musician.id}`, {
      method: "PATCH",
      body: form
    });
    await onSaved();
  };

  const archive = async () => {
    await api(`/api/admin/musicians/${musician.id}`, { method: "DELETE" });
    await onSaved();
  };

  const restore = async () => {
    await api(`/api/admin/musicians/${musician.id}`, {
      method: "PATCH",
      body: { status: "active" }
    });
    await onSaved();
  };

  return (
    <article className="member-card">
      <div className="member-heading">
        <div>
          <h3>{displayName(musician)}</h3>
          <span>{musician.status}</span>
        </div>
        <div className="icon-actions">
          <button title="Сохранить" onClick={save}>
            <Save size={18} />
          </button>
          {musician.status === "archived" ? (
            <button title="Вернуть из архива" onClick={restore}>
              <RefreshCw size={18} />
            </button>
          ) : (
            <button title="Архивировать" onClick={archive}>
              <Archive size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="compact-grid">
        <label>
          Цена
          <input
            type="number"
            value={form.monthlyPrice}
            onChange={(event) => setForm({ ...form, monthlyPrice: Number(event.target.value) })}
          />
        </label>
        <label>
          День
          <input
            type="number"
            min={1}
            max={31}
            value={form.paymentDay}
            onChange={(event) => setForm({ ...form, paymentDay: Number(event.target.value) })}
          />
        </label>
        <label>
          Льгота, дн.
          <input
            type="number"
            value={form.gracePeriodDays ?? ""}
            onChange={(event) =>
              setForm({
                ...form,
                gracePeriodDays: event.target.value === "" ? null : Number(event.target.value)
              })
            }
          />
        </label>
        <label>
          Льгота, ч.
          <input
            type="number"
            value={form.gracePeriodHours ?? ""}
            onChange={(event) =>
              setForm({
                ...form,
                gracePeriodHours: event.target.value === "" ? null : Number(event.target.value)
              })
            }
          />
        </label>
      </div>
      <InstrumentPicker
        value={form.instruments}
        onChange={(instruments) => setForm({ ...form, instruments })}
      />
    </article>
  );
}

function AdminSettings({ onDataChange }: { onDataChange: () => Promise<void> }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api<{ settings: AppSettings }>("/api/admin/settings");
    setSettings(result.settings);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const save = async () => {
    if (!settings) return;
    const result = await api<{ settings: AppSettings }>("/api/admin/settings", {
      method: "PATCH",
      body: settings
    });
    setSettings(result.settings);
    await onDataChange();
  };

  const sendTestPaymentReminder = async () => {
    setNotifyBusy(true);
    setNotifyMessage(null);
    try {
      const result = await api<{ sent: number }>("/api/admin/settings/test-payment-reminder", {
        method: "POST"
      });
      setNotifyMessage(`Тестовое оповещение отправлено: ${result.sent}`);
    } finally {
      setNotifyBusy(false);
    }
  };

  if (!settings) {
    return <section className="panel">...</section>;
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <div className="section-title">
          <Settings size={19} />
          <h2>Настройки</h2>
        </div>
        <div className="action-row">
          <button className="ghost-button" onClick={sendTestPaymentReminder} disabled={notifyBusy}>
            <Clock size={18} />
            Тест оплаты
          </button>
          <button className="primary-button" onClick={save}>
            <Save size={18} />
            Сохранить
          </button>
        </div>
      </div>
      {notifyMessage && <div className="notice">{notifyMessage}</div>}
      <div className="settings-grid">
        <label>
          День оплаты
          <input
            type="number"
            min={1}
            max={31}
            value={settings.defaultPaymentDay}
            onChange={(event) =>
              setSettings({ ...settings, defaultPaymentDay: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Льготный период, дн.
          <input
            type="number"
            value={settings.defaultGracePeriodDays}
            onChange={(event) =>
              setSettings({ ...settings, defaultGracePeriodDays: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Льготный период, ч.
          <input
            type="number"
            value={settings.defaultGracePeriodHours}
            onChange={(event) =>
              setSettings({ ...settings, defaultGracePeriodHours: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Напоминать за, дн.
          <input
            type="number"
            value={settings.reminderDaysBefore}
            onChange={(event) =>
              setSettings({ ...settings, reminderDaysBefore: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Время рассылки
          <input
            type="time"
            value={settings.reminderTime}
            onChange={(event) => setSettings({ ...settings, reminderTime: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
