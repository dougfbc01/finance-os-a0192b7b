import {
  Wallet,
  Landmark,
  Banknote,
  PiggyBank,
  CreditCard,
  Briefcase,
  TrendingUp,
  Coins,
  Globe,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import type { AccountIcon } from "@/constants";

const map: Record<AccountIcon, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  "credit-card": CreditCard,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  coins: Coins,
  globe: Globe,
  "circle-dollar-sign": CircleDollarSign,
};

export function getAccountIcon(name: string): LucideIcon {
  return (map as Record<string, LucideIcon>)[name] ?? Wallet;
}
