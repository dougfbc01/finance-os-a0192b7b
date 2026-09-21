import type { B3Event, B3Group, B3Impact, B3Nature } from "@/models/B3Import";

export interface B3Classification {
  group: B3Group;
  event: B3Event;
  cashImpact: B3Impact;
  positionImpact: B3Impact;
  nature: B3Nature;
  explanation: string;
}

const normalized = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();

const income = (event: B3Event, explanation: string): B3Classification => ({
  group: "B3_INCOME", event, cashImpact: "UNKNOWN", positionImpact: "NO", nature: "INCOME", explanation,
});
const investment = (event: B3Event, explanation: string): B3Classification => ({
  group: "B3_INVESTMENT_OPERATION", event, cashImpact: "UNKNOWN", positionImpact: "YES", nature: "INVESTMENT", explanation,
});
const position = (event: B3Event, explanation: string): B3Classification => ({
  group: "B3_POSITION_EVENT", event, cashImpact: "NO", positionImpact: "YES", nature: "POSITION_EVENT", explanation,
});
const corporate = (event: B3Event, explanation: string): B3Classification => ({
  group: "B3_CORPORATE_EVENT", event, cashImpact: "UNKNOWN", positionImpact: "UNKNOWN", nature: "CORPORATE_EVENT", explanation,
});
const transfer = (event: B3Event, explanation: string): B3Classification => ({
  group: "B3_TRANSFER", event, cashImpact: "UNKNOWN", positionImpact: "YES", nature: "TRANSFER", explanation,
});

const CLASSIFICATIONS: Record<string, B3Classification> = {
  DIVIDENDO: income("DIVIDEND", "Evento financeiro de dividendo; nenhum lançamento de caixa será criado."),
  "JUROS SOBRE CAPITAL PROPRIO": income("JCP", "Juros sobre capital próprio; nenhum lançamento de caixa será criado."),
  RENDIMENTO: income("YIELD", "Rendimento informado pela B3; nenhum lançamento de caixa será criado."),
  "RESTITUICAO DE CAPITAL": income("CAPITAL_RETURN", "Restituição de capital preservada como evento próprio, sem assumir rendimento."),
  COMPRA: investment("BUY", "Compra elegível para o histórico após revisão e confirmação explícita."),
  "COMPRA / VENDA": investment("BUY_SELL", "Operação combinada que exige revisão; compra e venda não serão inferidas."),
  RESGATE: investment("REDEMPTION", "Resgate elegível para o histórico após revisão e confirmação explícita."),
  VENCIMENTO: investment("MATURITY", "Vencimento preservado como evento próprio, sem tratá-lo automaticamente como venda."),
  "BONIFICACAO EM ATIVOS": position("BONUS", "Bonificação aumenta a posição e não representa caixa automaticamente."),
  DESDOBRO: position("SPLIT", "Desdobro altera a quantidade e não representa caixa."),
  GRUPAMENTO: position("REVERSE_SPLIT", "Grupamento altera a quantidade e não representa caixa."),
  INCORPORACAO: position("INCORPORATION", "Incorporação exige revisão da relação entre os ativos."),
  ATUALIZACAO: position("UPDATE", "Atualização de posição; não será interpretada como rendimento."),
  "DIREITO DE SUBSCRICAO": corporate("SUBSCRIPTION_RIGHT", "Direito de subscrição preservado como evento corporativo."),
  "DIREITOS DE SUBSCRICAO - NAO EXERCIDO": corporate("SUBSCRIPTION_RIGHT_NOT_EXERCISED", "Direito não exercido preservado para revisão."),
  "CESSAO DE DIREITOS": corporate("RIGHTS_ASSIGNMENT", "Cessão de direitos preservada como evento corporativo."),
  "CESSAO DE DIREITOS - SOLICITADA": corporate("RIGHTS_ASSIGNMENT_REQUESTED", "Solicitação de cessão preservada para revisão."),
  "FRACAO EM ATIVOS": corporate("FRACTION", "Fração preservada como evento corporativo, sem efeito financeiro inferido."),
  "LEILAO DE FRACAO": corporate("FRACTION_AUCTION", "Leilão de fração não será tratado automaticamente como venda."),
  TRANSFERENCIA: transfer("TRANSFER", "Transferência histórica sem conciliação automática."),
  "TRANSFERENCIA - LIQUIDACAO": transfer("TRANSFER_SETTLEMENT", "Liquidação de transferência altera posição, sem inferir compra ou venda."),
};

const UNKNOWN: B3Classification = {
  group: "B3_UNCLASSIFIED", event: "UNKNOWN", cashImpact: "UNKNOWN", positionImpact: "UNKNOWN", nature: "UNKNOWN",
  explanation: "Tipo de movimentação não reconhecido; revisão necessária.",
};

export class B3ClassificationService {
  static classify(movementType: string): B3Classification {
    return CLASSIFICATIONS[normalized(movementType)] ?? UNKNOWN;
  }

  static supportedTypes(): string[] {
    return Object.keys(CLASSIFICATIONS);
  }
}