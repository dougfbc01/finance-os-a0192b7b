import type { UUID, ISODateString } from "./index";

export interface ClassificationRule {
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

export interface CreateClassificationRuleInput {
  workspace_id: UUID;
  text_pattern: string;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  priority?: number;
  enabled?: boolean;
}

export interface UpdateClassificationRuleInput {
  text_pattern?: string;
  category_id?: UUID | null;
  subcategory_id?: UUID | null;
  priority?: number;
  enabled?: boolean;
}
