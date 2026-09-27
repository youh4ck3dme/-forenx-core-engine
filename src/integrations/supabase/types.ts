export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_feature_logs: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          feature: string;
          id: string;
          input_summary: string | null;
          model: string | null;
          output_summary: string | null;
          provider: string | null;
          success: boolean;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          feature: string;
          id?: string;
          input_summary?: string | null;
          model?: string | null;
          output_summary?: string | null;
          provider?: string | null;
          success?: boolean;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          feature?: string;
          id?: string;
          input_summary?: string | null;
          model?: string | null;
          output_summary?: string | null;
          provider?: string | null;
          success?: boolean;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          case_id: string | null;
          completion_tokens: number | null;
          created_at: string;
          error_code: string | null;
          finished_at: string | null;
          id: string;
          input_revision: string | null;
          model: string | null;
          prompt_tokens: number | null;
          prompt_version: string | null;
          status: string;
          task: string;
          user_id: string;
        };
        Insert: {
          case_id?: string | null;
          completion_tokens?: number | null;
          created_at?: string;
          error_code?: string | null;
          finished_at?: string | null;
          id?: string;
          input_revision?: string | null;
          model?: string | null;
          prompt_tokens?: number | null;
          prompt_version?: string | null;
          status?: string;
          task: string;
          user_id: string;
        };
        Update: {
          case_id?: string | null;
          completion_tokens?: number | null;
          created_at?: string;
          error_code?: string | null;
          finished_at?: string | null;
          id?: string;
          input_revision?: string | null;
          model?: string | null;
          prompt_tokens?: number | null;
          prompt_version?: string | null;
          status?: string;
          task?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      billing_events: {
        Row: {
          created_at: string;
          event_created_at: string | null;
          event_id: string;
          id: string;
          processed_at: string | null;
          provider: string;
          result: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_created_at?: string | null;
          event_id: string;
          id?: string;
          processed_at?: string | null;
          provider?: string;
          result?: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_created_at?: string | null;
          event_id?: string;
          id?: string;
          processed_at?: string | null;
          provider?: string;
          result?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      case_audit_log: {
        Row: {
          action: string;
          case_id: string | null;
          changes: Json | null;
          created_at: string;
          id: string;
          record_id: string | null;
          table_name: string;
          user_id: string;
        };
        Insert: {
          action: string;
          case_id?: string | null;
          changes?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name: string;
          user_id: string;
        };
        Update: {
          action?: string;
          case_id?: string | null;
          changes?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      case_entities: {
        Row: {
          address: string | null;
          case_id: string;
          country: string;
          created_at: string;
          ico: string | null;
          id: string;
          identity_key: string | null;
          incorporated_at: string | null;
          kind: string;
          licence: string | null;
          name: string;
          note: string | null;
          physical_inventory: boolean | null;
          registered_address: string | null;
          responsive: boolean | null;
          revision: number;
          role: string;
          updated_at: string;
          user_id: string;
          x: number;
          y: number;
        };
        Insert: {
          address?: string | null;
          case_id: string;
          country?: string;
          created_at?: string;
          ico?: string | null;
          id?: string;
          identity_key?: string | null;
          incorporated_at?: string | null;
          kind?: string;
          licence?: string | null;
          name: string;
          note?: string | null;
          physical_inventory?: boolean | null;
          registered_address?: string | null;
          responsive?: boolean | null;
          revision?: number;
          role?: string;
          updated_at?: string;
          user_id?: string;
          x?: number;
          y?: number;
        };
        Update: {
          address?: string | null;
          case_id?: string;
          country?: string;
          created_at?: string;
          ico?: string | null;
          id?: string;
          identity_key?: string | null;
          incorporated_at?: string | null;
          kind?: string;
          licence?: string | null;
          name?: string;
          note?: string | null;
          physical_inventory?: boolean | null;
          registered_address?: string | null;
          responsive?: boolean | null;
          revision?: number;
          role?: string;
          updated_at?: string;
          user_id?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "case_entities_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      case_events: {
        Row: {
          case_id: string;
          created_at: string;
          date: string;
          detail: string;
          id: string;
          revision: number;
          severity: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          date: string;
          detail?: string;
          id?: string;
          revision?: number;
          severity?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          date?: string;
          detail?: string;
          id?: string;
          revision?: number;
          severity?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      case_imports: {
        Row: {
          byte_size: number;
          case_id: string;
          column_mapping: Json;
          created_at: string;
          date_format: string;
          decimal_separator: string;
          delimiter: string;
          encoding: string;
          error_detail: string | null;
          error_rows: number;
          filename: string;
          id: string;
          original_stored: boolean;
          parser_version: string;
          partial: boolean;
          sha256: string;
          status: string;
          storage_path: string | null;
          total_rows: number;
          updated_at: string;
          user_id: string;
          valid_rows: number;
        };
        Insert: {
          byte_size: number;
          case_id: string;
          column_mapping?: Json;
          created_at?: string;
          date_format?: string;
          decimal_separator?: string;
          delimiter?: string;
          encoding?: string;
          error_detail?: string | null;
          error_rows?: number;
          filename: string;
          id?: string;
          original_stored?: boolean;
          parser_version: string;
          partial?: boolean;
          sha256: string;
          status?: string;
          storage_path?: string | null;
          total_rows?: number;
          updated_at?: string;
          user_id?: string;
          valid_rows?: number;
        };
        Update: {
          byte_size?: number;
          case_id?: string;
          column_mapping?: Json;
          created_at?: string;
          date_format?: string;
          decimal_separator?: string;
          delimiter?: string;
          encoding?: string;
          error_detail?: string | null;
          error_rows?: number;
          filename?: string;
          id?: string;
          original_stored?: boolean;
          parser_version?: string;
          partial?: boolean;
          sha256?: string;
          status?: string;
          storage_path?: string | null;
          total_rows?: number;
          updated_at?: string;
          user_id?: string;
          valid_rows?: number;
        };
        Relationships: [
          {
            foreignKeyName: "case_imports_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      case_relations: {
        Row: {
          case_id: string;
          created_at: string;
          from_id: string | null;
          id: string;
          label: string;
          revision: number;
          to_id: string | null;
          updated_at: string;
          user_id: string;
          valid_from: string | null;
          valid_to: string | null;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          from_id?: string | null;
          id?: string;
          label?: string;
          revision?: number;
          to_id?: string | null;
          updated_at?: string;
          user_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          from_id?: string | null;
          id?: string;
          label?: string;
          revision?: number;
          to_id?: string | null;
          updated_at?: string;
          user_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "case_relations_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_relations_from_id_fkey";
            columns: ["from_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_relations_to_id_fkey";
            columns: ["to_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      case_transactions: {
        Row: {
          amount: number;
          case_id: string;
          created_at: string;
          currency: string;
          date: string;
          description: string;
          destination_country: string;
          from_id: string | null;
          id: string;
          method: string;
          origin_country: string;
          payer_id: string | null;
          revision: number;
          to_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number;
          case_id: string;
          created_at?: string;
          currency?: string;
          date: string;
          description?: string;
          destination_country?: string;
          from_id?: string | null;
          id?: string;
          method?: string;
          origin_country?: string;
          payer_id?: string | null;
          revision?: number;
          to_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          case_id?: string;
          created_at?: string;
          currency?: string;
          date?: string;
          description?: string;
          destination_country?: string;
          from_id?: string | null;
          id?: string;
          method?: string;
          origin_country?: string;
          payer_id?: string | null;
          revision?: number;
          to_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_transactions_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_transactions_from_id_fkey";
            columns: ["from_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_transactions_payer_id_fkey";
            columns: ["payer_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_transactions_to_id_fkey";
            columns: ["to_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      case_weapons: {
        Row: {
          acquired_at: string | null;
          brand: string;
          case_id: string;
          created_at: string;
          holder_id: string | null;
          id: string;
          licence: string | null;
          model: string;
          revision: number;
          serial: string;
          supplier_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          acquired_at?: string | null;
          brand?: string;
          case_id: string;
          created_at?: string;
          holder_id?: string | null;
          id?: string;
          licence?: string | null;
          model?: string;
          revision?: number;
          serial?: string;
          supplier_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          acquired_at?: string | null;
          brand?: string;
          case_id?: string;
          created_at?: string;
          holder_id?: string | null;
          id?: string;
          licence?: string | null;
          model?: string;
          revision?: number;
          serial?: string;
          supplier_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_weapons_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_weapons_holder_id_fkey";
            columns: ["holder_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_weapons_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          base_currency: string;
          created_at: string;
          europol_serials: string[];
          forensic_dossier: Json | null;
          forensic_dossier_updated_at: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          orsr_addresses: Json;
          reference_date: string;
          revision: number;
          subtitle: string;
          updated_at: string;
          user_id: string;
          valid_licences: string[];
        };
        Insert: {
          base_currency?: string;
          created_at?: string;
          europol_serials?: string[];
          forensic_dossier?: Json | null;
          forensic_dossier_updated_at?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          orsr_addresses?: Json;
          reference_date?: string;
          revision?: number;
          subtitle?: string;
          updated_at?: string;
          user_id?: string;
          valid_licences?: string[];
        };
        Update: {
          base_currency?: string;
          created_at?: string;
          europol_serials?: string[];
          forensic_dossier?: Json | null;
          forensic_dossier_updated_at?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          orsr_addresses?: Json;
          reference_date?: string;
          revision?: number;
          subtitle?: string;
          updated_at?: string;
          user_id?: string;
          valid_licences?: string[];
        };
        Relationships: [];
      };
      company_registry_profiles: {
        Row: {
          address_history: Json;
          business_activities: Json;
          captured_at: string | null;
          case_id: string;
          country: string;
          created_at: string;
          dissolved_at: string | null;
          entity_id: string | null;
          ico: string;
          id: string;
          incorporated_at: string | null;
          legal_form: string | null;
          legal_name: string;
          raw_payload: Json | null;
          registered_address: string | null;
          source: string;
          source_hash: string;
          source_url: string | null;
          status: string;
          statutory_persons: Json;
          user_id: string;
        };
        Insert: {
          address_history?: Json;
          business_activities?: Json;
          captured_at?: string | null;
          case_id: string;
          country?: string;
          created_at?: string;
          dissolved_at?: string | null;
          entity_id?: string | null;
          ico: string;
          id?: string;
          incorporated_at?: string | null;
          legal_form?: string | null;
          legal_name: string;
          raw_payload?: Json | null;
          registered_address?: string | null;
          source: string;
          source_hash: string;
          source_url?: string | null;
          status?: string;
          statutory_persons?: Json;
          user_id: string;
        };
        Update: {
          address_history?: Json;
          business_activities?: Json;
          captured_at?: string | null;
          case_id?: string;
          country?: string;
          created_at?: string;
          dissolved_at?: string | null;
          entity_id?: string | null;
          ico?: string;
          id?: string;
          incorporated_at?: string | null;
          legal_form?: string | null;
          legal_name?: string;
          raw_payload?: Json | null;
          registered_address?: string | null;
          source?: string;
          source_hash?: string;
          source_url?: string | null;
          status?: string;
          statutory_persons?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_registry_profiles_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_registry_profiles_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "case_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      cross_border_analyses: {
        Row: {
          captured_at: string | null;
          case_id: string;
          countries: Json;
          created_at: string;
          id: string;
          intermediaries: Json;
          nominee_indicators: Json;
          raw_payload: Json | null;
          report_id: string;
          routes: Json;
          signals: Json;
          source: string;
          source_hash: string | null;
          source_url: string | null;
          user_id: string;
        };
        Insert: {
          captured_at?: string | null;
          case_id: string;
          countries?: Json;
          created_at?: string;
          id?: string;
          intermediaries?: Json;
          nominee_indicators?: Json;
          raw_payload?: Json | null;
          report_id: string;
          routes?: Json;
          signals?: Json;
          source: string;
          source_hash?: string | null;
          source_url?: string | null;
          user_id: string;
        };
        Update: {
          captured_at?: string | null;
          case_id?: string;
          countries?: Json;
          created_at?: string;
          id?: string;
          intermediaries?: Json;
          nominee_indicators?: Json;
          raw_payload?: Json | null;
          report_id?: string;
          routes?: Json;
          signals?: Json;
          source?: string;
          source_hash?: string | null;
          source_url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cross_border_analyses_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      deletion_requests: {
        Row: {
          created_at: string;
          error_detail: string | null;
          finished_at: string | null;
          id: string;
          scope: string;
          status: string;
          steps: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error_detail?: string | null;
          finished_at?: string | null;
          id?: string;
          scope?: string;
          status?: string;
          steps?: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error_detail?: string | null;
          finished_at?: string | null;
          id?: string;
          scope?: string;
          status?: string;
          steps?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      error_logs: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          route: string | null;
          severity: string;
          source: string;
          stack: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          route?: string | null;
          severity?: string;
          source?: string;
          stack?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          route?: string | null;
          severity?: string;
          source?: string;
          stack?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          onboarding_completed: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          customer_id: string | null;
          environment: string;
          id: string;
          last_event_at: string | null;
          plan: string;
          price_id: string | null;
          provider: string;
          status: string;
          subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          customer_id?: string | null;
          environment: string;
          id?: string;
          last_event_at?: string | null;
          plan?: string;
          price_id?: string | null;
          provider?: string;
          status?: string;
          subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          customer_id?: string | null;
          environment?: string;
          id?: string;
          last_event_at?: string | null;
          plan?: string;
          price_id?: string | null;
          provider?: string;
          status?: string;
          subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      commit_ai_case_graph: {
        Args: { _case_id: string; _graph: Json };
        Returns: Json;
      };
      commit_import: {
        Args: { _actor: string; _import: string; _rows: Json };
        Returns: number;
      };
      current_plan: { Args: { _user: string }; Returns: string };
      db_health_stats: { Args: never; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      owns_case: { Args: { _case_id: string }; Returns: boolean };
      reserve_ai_call: {
        Args: {
          _case: string;
          _daily_limit: number;
          _input_revision: string;
          _model: string;
          _prompt_version: string;
          _task: string;
          _user: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
