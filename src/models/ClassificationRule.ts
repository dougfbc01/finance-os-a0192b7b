import type { MovementType } from "@/constants/enums";
import type { UUID, ISODateString } from "./index";

/** Direção financeira da movimentação usada pelas regras (Sprint 4.5.1). */
export type RuleDirection = "IN" | "OUT";

/**
 * Condições estruturais opcionais de uma regra.
 * Quando preenchidas, tornam a regra mais específica e mais forte.
 */
export interface ClassificationRuleConditions {
  /** Trecho do beneficiário/contraparte extraído da descrição. */
  counterparty_pattern: string | null;
  /** Restringe a regra a um tipo de movimentação. */
  movement_type: MovementType | null;
  /** Restringe a regra a entradas ou saídas. */
  direction: RuleDirection | null;
  account_id: UUID | null;
  card_id: UUID | null;
}

export interface ClassificationRule extends ClassificationRuleConditions {
  id: UUID;
  workspace_id: UUID;
  text_pattern: string;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  priority: number;
  enabled: boolean;
  match_count: number;
  last_matched_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateClassificationRuleInput extends Partial<ClassificationRuleConditions> {
  workspace_id: UUID;
  text_pattern: string;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  priority?: number;
  enabled?: boolean;
}

export interface UpdateClassificationRuleInput extends Partial<ClassificationRuleConditions> {
  text_pattern?: string;
  category_id?: UUID | null;
  subcategory_id?: UUID | null;
  priority?: number;
  enabled?: boolean;
}
