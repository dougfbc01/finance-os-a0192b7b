import { CategoryType } from "./enums";

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  [CategoryType.INCOME]: "Receita",
  [CategoryType.EXPENSE]: "Despesa",
  [CategoryType.TRANSFER]: "Transferência",
  [CategoryType.INVESTMENT]: "Investimento",
};

export const CATEGORY_TYPE_OPTIONS = Object.values(CategoryType).map((v) => ({
  value: v,
  label: CATEGORY_TYPE_LABELS[v],
}));

export const CATEGORY_COLOR_OPTIONS = [
  "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899",
  "#8B5CF6", "#06B6D4", "#0EA5E9", "#64748B", "#22C55E",
  "#7C3AED", "#94A3B8",
];

export const CATEGORY_ICON_OPTIONS = [
  "folder", "trending-up", "home", "utensils", "car", "heart-pulse",
  "graduation-cap", "party-popper", "repeat", "landmark", "line-chart",
  "arrow-left-right", "wallet", "shopping-bag", "gift", "briefcase",
];
