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
          quantity: number
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
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
          quantity?: number
          unit_price?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
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
          quantity?: number
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
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
          category_id: string | null
          created_at: string
          deleted_at: string | null
          enabled: boolean
          id: string
          last_matched_at: string | null
          match_count: number
          priority: number
          subcategory_id: string | null
          text_pattern: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          last_matched_at?: string | null
          match_count?: number
          priority?: number
          subcategory_id?: string | null
          text_pattern: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          last_matched_at?: string | null
          match_count?: number
          priority?: number
          subcategory_id?: string | null
          text_pattern?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
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
          id: string
          import_id: string | null
          invoice_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["movement_status"]
          subcategory_id: string | null
          tags: string[]
          transaction_date: string
          transfer_account_id: string | null
          transfer_group_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
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
          id?: string
          import_id?: string | null
          invoice_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["movement_status"]
          subcategory_id?: string | null
          tags?: string[]
          transaction_date: string
          transfer_account_id?: string | null
          transfer_group_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
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
          id?: string
          import_id?: string | null
          invoice_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["movement_status"]
          subcategory_id?: string | null
          tags?: string[]
          transaction_date?: string
          transfer_account_id?: string | null
          transfer_group_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
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
      recompute_card_invoice: {
        Args: { _invoice_id: string }
        Returns: undefined
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
      card_invoice_status: "OPEN" | "CLOSED" | "PAID" | "OVERDUE"
      category_type: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT"
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
      ],
      card_invoice_status: ["OPEN", "CLOSED", "PAID", "OVERDUE"],
      category_type: ["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT"],
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
