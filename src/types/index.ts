// Types: tipos utilitários e contratos de UI/aplicação.
// Entidades de domínio ficam em src/models.

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { AppRoute } from "@/constants";

export interface NavItem {
  title: string;
  url: AppRoute;
  icon: LucideIcon;
}

export interface DashboardWidget {
  id: string;
  title: string;
  /** Largura em colunas da grid (1-12). Default 4. */
  colSpan?: number;
  component: ComponentType;
}

// Re-export para compatibilidade com imports antigos.
export type { UUID, Workspace, Profile } from "@/models";
