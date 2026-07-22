import type { UUID, ISODateString } from "./index";
import type { CategoryType } from "@/constants/enums";

export interface Category {
  id: UUID;
  workspace_id: UUID;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  display_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface Subcategory {
  id: UUID;
  category_id: UUID;
  workspace_id: UUID;
  name: string;
  display_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface CreateCategoryInput {
  workspace_id: UUID;
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  display_order?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface CreateSubcategoryInput {
  category_id: UUID;
  workspace_id: UUID;
  name: string;
  display_order?: number;
}

export interface UpdateSubcategoryInput {
  name?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
}
