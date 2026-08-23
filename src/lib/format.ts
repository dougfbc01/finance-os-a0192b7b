export function formatCurrency(value: number, currency = "BRL", locale = "pt-BR") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDate(value: string | Date, locale = "pt-BR") {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonth(ref = new Date()) {
  return new Date(ref.getFullYear(), ref.getMonth(), 1);
}

export function lastDayOfMonth(ref = new Date()) {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
}

export function addMonths(ref: Date, delta: number) {
  return new Date(ref.getFullYear(), ref.getMonth() + delta, 1);
}

/** Sprint 4.11 — data e hora curtas (usado no timestamp de cotações). */
export function formatDateTime(value: string | Date, locale = "pt-BR") {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
