export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          color: string
          created_at: string
          currency: string
          deleted_at: string | null
          display_order: number
          icon: string
          id: string
          initial_balance: number
          institution: string | null
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          color?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          initial_balance?: number
          institution?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          color?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          initial_balance?: number
          institution?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          account_id: string | null
          acquisition_date: string | null
          acquisition_value: number
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          currency: string
          current_value: number
          deleted_at: string | null
          id: string
          institution: string | null
          is_active: boolean
          name: string
          notes: string | null
          opening_value: number
          quantity: number
          ticker: string | null
          unit_price: number
          updated_at: string
          valuation_source: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          acquisition_date?: string | null
          acquisition_value?: number
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          currency?: string
          current_value?: number
          deleted_at?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          opening_value?: number
          quantity?: number
          ticker?: string | null
          unit_price?: number
          updated_at?: string
          valuation_source?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          acquisition_date?: string | null
          acquisition_value?: number
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          currency?: string
          current_value?: number
          deleted_at?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_value?: number
          quantity?: number
          ticker?: string | null
          unit_price?: number
          updated_at?: string
          valuation_source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      card_invoices: {
        Row: {
          amount: number
          card_id: string
          closing_date: string
          competence: string
          created_at: string
          deleted_at: string | null
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_movement_id: string | null
          status: Database["public"]["Enums"]["card_invoice_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          card_id: string
          closing_date: string
          competence: string
          created_at?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_movement_id?: string | null
          status?: Database["public"]["Enums"]["card_invoice_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          card_id?: string
          closing_date?: string
          competence?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_movement_id?: string | null
          status?: Database["public"]["Enums"]["card_invoice_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_invoices_paid_movement_id_fkey"
            columns: ["paid_movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          account_id: string | null
          brand: string | null
          closing_day: number
          color: string
          created_at: string
          credit_limit: number
          deleted_at: string | null
          display_order: number
          due_day: number
          holder_name: string | null
          id: string
          is_active: boolean
          last_digits: string | null
          name: string
          notes: string | null
          parent_card_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          brand?: string | null
          closing_day: number
          color?: string
          created_at?: string
          credit_limit?: number
          deleted_at?: string | null
          display_order?: number
          due_day: number
          holder_name?: string | null
          id?: string
          is_active?: boolean
          last_digits?: string | null
          name: string
          notes?: string | null
          parent_card_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          brand?: string | null
          closing_day?: number
          color?: string
          created_at?: string
          credit_limit?: number
          deleted_at?: string | null
          display_order?: number
          due_day?: number
          holder_name?: string | null
          id?: string
          is_active?: boolean
          last_digits?: string | null
          name?: string
          notes?: string | null
          parent_card_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_parent_card_id_fkey"
            columns: ["parent_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_rules: {
        Row: {
          account_id: string | null
          card_id: string | null
          category_id: string | null
          counterparty_pattern: string | null
          created_at: string
          deleted_at: string | null
          direction: string | null
          enabled: boolean
          id: string
          last_matched_at: string | null
          match_count: number
          movement_type: Database["public"]["Enums"]["movement_type"] | null
          priority: number
          subcategory_id: string | null
          text_pattern: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          card_id?: string | null
          category_id?: string | null
          counterparty_pattern?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string | null
          enabled?: boolean
          id?: string
          last_matched_at?: string | null
          match_count?: number
          movement_type?: Database["public"]["Enums"]["movement_type"] | null
          priority?: number
          subcategory_id?: string | null
          text_pattern: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          card_id?: string | null
          category_id?: string | null
          counterparty_pattern?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string | null
          enabled?: boolean
          id?: string
          last_matched_at?: string | null
          match_count?: number
          movement_type?: Database["public"]["Enums"]["movement_type"] | null
          priority?: number
          subcategory_id?: string | null
          text_pattern?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_installments: {
        Row: {
          amount: number
          commitment_id: string
          competence_date: string
          created_at: string
          deleted_at: string | null
          due_date: string
          id: string
          installment_number: number
          movement_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["commitment_installment_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          commitment_id: string
          competence_date: string
          created_at?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          movement_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["commitment_installment_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          commitment_id?: string
          competence_date?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          movement_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["commitment_installment_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitment_installments_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitment_installments_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitment_installments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          account_id: string | null
          card_id: string | null
          category_id: string | null
          commitment_type: Database["public"]["Enums"]["commitment_type"]
          created_at: string
          deleted_at: string | null
          description: string | null
          due_day: number | null
          id: string
          installment_amount: number
          installments_count: number
          name: string
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["commitment_status"]
          subcategory_id: string | null
          total_amount: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          card_id?: string | null
          category_id?: string | null
          commitment_type?: Database["public"]["Enums"]["commitment_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_day?: number | null
          id?: string
          installment_amount?: number
          installments_count?: number
          name: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          subcategory_id?: string | null
          total_amount?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          card_id?: string | null
          category_id?: string | null
          commitment_type?: Database["public"]["Enums"]["commitment_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_day?: number | null
          id?: string
          installment_amount?: number
          installments_count?: number
          name?: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          subcategory_id?: string | null
          total_amount?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dedup_audits: {
        Row: {
          changed_fields: Json
          confidence_match: number
          created_at: string
          id: string
          incoming_movement_id: string | null
          incoming_snapshot: Json
          original_movement_id: string | null
          original_snapshot: Json
          performed_by: string | null
          reason: string
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          changed_fields?: Json
          confidence_match?: number
          created_at?: string
          id?: string
          incoming_movement_id?: string | null
          incoming_snapshot?: Json
          original_movement_id?: string | null
          original_snapshot?: Json
          performed_by?: string | null
          reason?: string
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          changed_fields?: Json
          confidence_match?: number
          created_at?: string
          id?: string
          incoming_movement_id?: string | null
          incoming_snapshot?: Json
          original_movement_id?: string | null
          original_snapshot?: Json
          performed_by?: string | null
          reason?: string
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedup_audits_incoming_movement_id_fkey"
            columns: ["incoming_movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dedup_audits_original_movement_id_fkey"
            columns: ["original_movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dedup_audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goal_accounts: {
        Row: {
          account_id: string
          created_at: string
          goal_id: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          goal_id: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          goal_id?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_goal_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_goal_accounts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_goal_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goal_contributions: {
        Row: {
          amount: number
          contribution_date: string
          created_at: string
          deleted_at: string | null
          goal_id: string
          id: string
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          contribution_date?: string
          created_at?: string
          deleted_at?: string | null
          goal_id: string
          id?: string
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          contribution_date?: string
          created_at?: string
          deleted_at?: string | null
          goal_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_goal_contributions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          goal_type: Database["public"]["Enums"]["financial_goal_type"]
          id: string
          initial_amount: number
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["financial_goal_status"]
          target_amount: number
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["financial_goal_type"]
          id?: string
          initial_amount?: number
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["financial_goal_status"]
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["financial_goal_type"]
          id?: string
          initial_amount?: number
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["financial_goal_status"]
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      health_check_runs: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          duration_ms: number
          error_message: string | null
          id: string
          issues: number
          report: Json
          source: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          issues?: number
          report?: Json
          source?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          issues?: number
          report?: Json
          source?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_check_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      health_check_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          hour_utc: number
          id: string
          last_run_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_check_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          account_id: string | null
          created_at: string
          duplicated_rows: number
          file_hash: string
          file_name: string
          id: string
          ignored_rows: number
          imported_at: string
          imported_by: string | null
          imported_rows: number
          log: Json
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["import_source"]
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          duplicated_rows?: number
          file_hash: string
          file_name: string
          id?: string
          ignored_rows?: number
          imported_at?: string
          imported_by?: string | null
          imported_rows?: number
          log?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: Database["public"]["Enums"]["import_source"]
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          duplicated_rows?: number
          file_hash?: string
          file_name?: string
          id?: string
          ignored_rows?: number
          imported_at?: string
          imported_by?: string | null
          imported_rows?: number
          log?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["import_source"]
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budget_items: {
        Row: {
          budget_id: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          goal_kind: string | null
          id: string
          notes: string | null
          planned_amount: number
          subcategory_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_id: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          goal_kind?: string | null
          id?: string
          notes?: string | null
          planned_amount?: number
          subcategory_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_id?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          goal_kind?: string | null
          id?: string
          notes?: string | null
          planned_amount?: number
          subcategory_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "monthly_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_budget_items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_budget_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budgets: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          mode: string
          month: number
          name: string
          notes: string | null
          status: string
          updated_at: string
          workspace_id: string
          year: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          mode?: string
          month: number
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
          year: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          mode?: string
          month?: number
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closing_events: {
        Row: {
          closing_id: string
          created_at: string
          event: string
          id: string
          performed_by: string | null
          reason: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          closing_id: string
          created_at?: string
          event: string
          id?: string
          performed_by?: string | null
          reason?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          closing_id?: string
          created_at?: string
          event?: string
          id?: string
          performed_by?: string | null
          reason?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closing_events_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "monthly_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closing_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closings: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          month: number
          notes: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          snapshot_json: Json
          status: string
          updated_at: string
          workspace_id: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          month: number
          notes?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          snapshot_json?: Json
          status?: string
          updated_at?: string
          workspace_id: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          month?: number
          notes?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          snapshot_json?: Json
          status?: string
          updated_at?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          account_id: string | null
          amount: number
          asset_id: string | null
          attachments: Json
          card_id: string | null
          category_id: string | null
          competence_date: string | null
          created_at: string
          deleted_at: string | null
          description: string
          due_date: string | null
          duplicate_hash: string | null
          external_ref: string | null
          id: string
          import_id: string | null
          invoice_id: string | null
          is_historical: boolean
          notes: string | null
          quantity: number | null
          status: Database["public"]["Enums"]["movement_status"]
          subcategory_id: string | null
          tags: string[]
          transaction_date: string
          transfer_account_id: string | null
          transfer_group_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          asset_id?: string | null
          attachments?: Json
          card_id?: string | null
          category_id?: string | null
          competence_date?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          duplicate_hash?: string | null
          external_ref?: string | null
          id?: string
          import_id?: string | null
          invoice_id?: string | null
          is_historical?: boolean
          notes?: string | null
          quantity?: number | null
          status?: Database["public"]["Enums"]["movement_status"]
          subcategory_id?: string | null
          tags?: string[]
          transaction_date: string
          transfer_account_id?: string | null
          transfer_group_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          asset_id?: string | null
          attachments?: Json
          card_id?: string | null
          category_id?: string | null
          competence_date?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          duplicate_hash?: string | null
          external_ref?: string | null
          id?: string
          import_id?: string | null
          invoice_id?: string | null
          is_historical?: boolean
          notes?: string | null
          quantity?: number | null
          status?: Database["public"]["Enums"]["movement_status"]
          subcategory_id?: string | null
          tags?: string[]
          transaction_date?: string
          transfer_account_id?: string | null
          transfer_group_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          unit_price?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "card_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_transfer_account_id_fkey"
            columns: ["transfer_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      financial_health_check: { Args: { _workspace_id: string }; Returns: Json }
      recompute_card_invoice: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recompute_my_card_invoice: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recompute_workspace_invoices: {
        Args: { _workspace_id: string }
        Returns: number
      }
      seed_default_categories: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "CHECKING"
        | "SAVINGS"
        | "DIGITAL"
        | "WALLET"
        | "BROKER"
        | "CASH"
        | "INTERNATIONAL"
        | "OTHER"
      asset_type:
        | "BANK"
        | "CASH"
        | "CDB"
        | "TESOURO"
        | "LCI"
        | "LCA"
        | "DEBENTURE"
        | "ACAO"
        | "FII"
        | "ETF"
        | "BDR"
        | "CRIPTO"
        | "PREVIDENCIA"
        | "FUNDO"
        | "CAIXINHA"
        | "OUTRO"
        | "POUPANCA"
        | "RENDA_FIXA"
      card_invoice_status: "OPEN" | "CLOSED" | "PAID" | "OVERDUE"
      category_type: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT"
      commitment_installment_status:
        | "FORECAST"
        | "POSTED"
        | "PAID"
        | "CANCELLED"
      commitment_status: "ACTIVE" | "SETTLED" | "CANCELLED" | "PAUSED"
      commitment_type:
        | "SUBSCRIPTION"
        | "INSTALLMENT"
        | "LOAN"
        | "FINANCING"
        | "FIXED_BILL"
        | "OTHER"
      financial_goal_status: "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED"
      financial_goal_type:
        | "EMERGENCY_RESERVE"
        | "PURCHASE"
        | "TRAVEL"
        | "INVESTMENT"
        | "PATRIMONY"
        | "CUSTOM"
      import_source: "NUBANK_ACCOUNT" | "NUBANK_CREDIT_CARD" | "OFX" | "MANUAL"
      import_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "PARTIAL"
      movement_status: "PENDING" | "CLEARED" | "RECONCILED"
      movement_type:
        | "INCOME"
        | "EXPENSE"
        | "TRANSFER"
        | "CARD_PAYMENT"
        | "INVESTMENT"
        | "DIVIDEND"
        | "INTEREST"
        | "FEE"
        | "TAX"
        | "REFUND"
        | "ADJUSTMENT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: [
        "CHECKING",
        "SAVINGS",
        "DIGITAL",
        "WALLET",
        "BROKER",
        "CASH",
        "INTERNATIONAL",
        "OTHER",
      ],
      asset_type: [
        "BANK",
        "CASH",
        "CDB",
        "TESOURO",
        "LCI",
        "LCA",
        "DEBENTURE",
        "ACAO",
        "FII",
        "ETF",
        "BDR",
        "CRIPTO",
        "PREVIDENCIA",
        "FUNDO",
        "CAIXINHA",
        "OUTRO",
        "POUPANCA",
        "RENDA_FIXA",
      ],
      card_invoice_status: ["OPEN", "CLOSED", "PAID", "OVERDUE"],
      category_type: ["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT"],
      commitment_installment_status: [
        "FORECAST",
        "POSTED",
        "PAID",
        "CANCELLED",
      ],
      commitment_status: ["ACTIVE", "SETTLED", "CANCELLED", "PAUSED"],
      commitment_type: [
        "SUBSCRIPTION",
        "INSTALLMENT",
        "LOAN",
        "FINANCING",
        "FIXED_BILL",
        "OTHER",
      ],
      financial_goal_status: ["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"],
      financial_goal_type: [
        "EMERGENCY_RESERVE",
        "PURCHASE",
        "TRAVEL",
        "INVESTMENT",
        "PATRIMONY",
        "CUSTOM",
      ],
      import_source: ["NUBANK_ACCOUNT", "NUBANK_CREDIT_CARD", "OFX", "MANUAL"],
      import_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "PARTIAL",
      ],
      movement_status: ["PENDING", "CLEARED", "RECONCILED"],
      movement_type: [
        "INCOME",
        "EXPENSE",
        "TRANSFER",
        "CARD_PAYMENT",
        "INVESTMENT",
        "DIVIDEND",
        "INTEREST",
        "FEE",
        "TAX",
        "REFUND",
        "ADJUSTMENT",
      ],
    },
  },
} as const
