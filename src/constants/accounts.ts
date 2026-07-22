// Paleta padrão para cores de conta
export const ACCOUNT_COLORS: { name: string; value: string }[] = [
  { name: "Roxo", value: "#7C3AED" },
  { name: "Rosa", value: "#EC4899" },
  { name: "Vermelho", value: "#EF4444" },
  { name: "Laranja", value: "#F97316" },
  { name: "Amarelo", value: "#EAB308" },
  { name: "Verde", value: "#22C55E" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Azul", value: "#3B82F6" },
  { name: "Índigo", value: "#6366F1" },
  { name: "Cinza", value: "#64748B" },
];

// Ícones (lucide) disponíveis para contas
export const ACCOUNT_ICONS = [
  "wallet",
  "landmark",
  "banknote",
  "piggy-bank",
  "credit-card",
  "briefcase",
  "trending-up",
  "coins",
  "globe",
  "circle-dollar-sign",
] as const;

export type AccountIcon = (typeof ACCOUNT_ICONS)[number];

export const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];
