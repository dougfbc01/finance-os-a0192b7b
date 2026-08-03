// Rotas do sistema centralizadas para reuso em navegação e testes.
export const ROUTES = {
  AUTH: "/auth",
  AUTH_FORGOT_PASSWORD: "/auth/forgot-password",
  AUTH_RESET_PASSWORD: "/auth/reset-password",
  DASHBOARD: "/dashboard",
  CONTAS: "/contas",
  CATEGORIAS: "/categorias",
  MOVIMENTACOES: "/movimentacoes",
  CARTOES: "/cartoes",
  INVESTIMENTOS: "/investimentos",
  PATRIMONIO: "/patrimonio",
  PLANEJAMENTO: "/planejamento",
  RELATORIOS: "/relatorios",
  CONFIGURACOES: "/configuracoes",
  IMPORTACOES: "/importacoes",
  TRANSFERENCIAS_PENDENTES: "/transferencias-pendentes",
  REGRAS: "/regras",
  DUPLICIDADES: "/duplicidades",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
