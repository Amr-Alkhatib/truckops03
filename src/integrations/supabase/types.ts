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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          config: Json
          id: number
          updated_at: string
        }
        Insert: {
          config: Json
          id?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      booking_audit: {
        Row: {
          actor: string
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor: string
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor?: string
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          address: string
          approval_token: string | null
          approver_email: string | null
          approver_name: string | null
          billing_address: string
          clearance_m: number | null
          client_response_reason: string | null
          company_name: string
          contact_mobile: string
          contact_name: string
          created_at: string
          distance_computed_at: string
          distance_km: number
          distance_method: string
          end_time: string
          espresso: boolean
          event_date: string
          gluten_free: number
          guests: number
          halal: number
          has_400v: boolean
          id: string
          lat: number
          lon: number
          package: string
          po_number: string
          quote: Json
          ref: string
          space_m2: number
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          total_gross: number
          total_net: number
          town: string
          truck_ids: string[]
          updated_at: string
          user_id: string
          vegan: number
          venue_name: string
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Insert: {
          address: string
          approval_token?: string | null
          approver_email?: string | null
          approver_name?: string | null
          billing_address: string
          clearance_m?: number | null
          client_response_reason?: string | null
          company_name: string
          contact_mobile: string
          contact_name: string
          created_at?: string
          distance_computed_at: string
          distance_km: number
          distance_method: string
          end_time: string
          espresso?: boolean
          event_date: string
          gluten_free: number
          guests: number
          halal: number
          has_400v: boolean
          id?: string
          lat: number
          lon: number
          package: string
          po_number: string
          quote: Json
          ref?: string
          space_m2: number
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_gross: number
          total_net: number
          town: string
          truck_ids?: string[]
          updated_at?: string
          user_id: string
          vegan: number
          venue_name: string
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Update: {
          address?: string
          approval_token?: string | null
          approver_email?: string | null
          approver_name?: string | null
          billing_address?: string
          clearance_m?: number | null
          client_response_reason?: string | null
          company_name?: string
          contact_mobile?: string
          contact_name?: string
          created_at?: string
          distance_computed_at?: string
          distance_km?: number
          distance_method?: string
          end_time?: string
          espresso?: boolean
          event_date?: string
          gluten_free?: number
          guests?: number
          halal?: number
          has_400v?: boolean
          id?: string
          lat?: number
          lon?: number
          package?: string
          po_number?: string
          quote?: Json
          ref?: string
          space_m2?: number
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_gross?: number
          total_net?: number
          town?: string
          truck_ids?: string[]
          updated_at?: string
          user_id?: string
          vegan?: number
          venue_name?: string
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Relationships: []
      }
      compliance_docs: {
        Row: {
          crew_member: string | null
          doc_type: string
          expires_on: string | null
          id: string
          label: string
          notes: string
          required: boolean
          truck_id: string | null
        }
        Insert: {
          crew_member?: string | null
          doc_type: string
          expires_on?: string | null
          id?: string
          label: string
          notes?: string
          required?: boolean
          truck_id?: string | null
        }
        Update: {
          crew_member?: string | null
          doc_type?: string
          expires_on?: string | null
          id?: string
          label?: string
          notes?: string
          required?: boolean
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_docs_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      event_presets: {
        Row: {
          address: string
          clearance_m: number | null
          created_at: string
          end_time: string
          gluten_free: number
          guests: number
          halal: number
          has_400v: boolean
          id: string
          label: string
          lat: number | null
          lon: number | null
          notes: string
          space_m2: number
          start_time: string
          town: string
          user_id: string
          vegan: number
          venue_name: string
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Insert: {
          address: string
          clearance_m?: number | null
          created_at?: string
          end_time: string
          gluten_free?: number
          guests: number
          halal?: number
          has_400v?: boolean
          id?: string
          label: string
          lat?: number | null
          lon?: number | null
          notes?: string
          space_m2: number
          start_time: string
          town?: string
          user_id: string
          vegan?: number
          venue_name: string
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Update: {
          address?: string
          clearance_m?: number | null
          created_at?: string
          end_time?: string
          gluten_free?: number
          guests?: number
          halal?: number
          has_400v?: boolean
          id?: string
          label?: string
          lat?: number | null
          lon?: number | null
          notes?: string
          space_m2?: number
          start_time?: string
          town?: string
          user_id?: string
          vegan?: number
          venue_name?: string
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          id: string
          payload: Json
          reason: string
          status: string
          town: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          reason: string
          status?: string
          town?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          reason?: string
          status?: string
          town?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pair_rules: {
        Row: {
          active: boolean
          description: string
          id: string
          rule_type: Database["public"]["Enums"]["pair_rule_type"]
          truck_ids: string[]
        }
        Insert: {
          active?: boolean
          description?: string
          id?: string
          rule_type: Database["public"]["Enums"]["pair_rule_type"]
          truck_ids: string[]
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          rule_type?: Database["public"]["Enums"]["pair_rule_type"]
          truck_ids?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          billing_address: string
          company_name: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          billing_address?: string
          company_name?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          billing_address?: string
          company_name?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      towns: {
        Row: {
          contact: string
          fee_amount: number
          fee_model: string
          generators_allowed: boolean
          id: string
          issuing_authority: string
          lead_time_weeks: number
          max_trucks: number
          name: string
          notes: string
          permit_name: string
          quiet_hours_mode: string
          quiet_hours_start: string | null
          verified_on: string | null
        }
        Insert: {
          contact?: string
          fee_amount?: number
          fee_model?: string
          generators_allowed?: boolean
          id?: string
          issuing_authority?: string
          lead_time_weeks?: number
          max_trucks?: number
          name: string
          notes?: string
          permit_name?: string
          quiet_hours_mode?: string
          quiet_hours_start?: string | null
          verified_on?: string | null
        }
        Update: {
          contact?: string
          fee_amount?: number
          fee_model?: string
          generators_allowed?: boolean
          id?: string
          issuing_authority?: string
          lead_time_weeks?: number
          max_trucks?: number
          name?: string
          notes?: string
          permit_name?: string
          quiet_hours_mode?: string
          quiet_hours_start?: string | null
          verified_on?: string | null
        }
        Relationships: []
      }
      truck_blackouts: {
        Row: {
          end_date: string | null
          id: string
          reason: string
          recurring_month: number | null
          start_date: string | null
          truck_id: string
        }
        Insert: {
          end_date?: string | null
          id?: string
          reason?: string
          recurring_month?: number | null
          start_date?: string | null
          truck_id: string
        }
        Update: {
          end_date?: string | null
          id?: string
          reason?: string
          recurring_month?: number | null
          start_date?: string | null
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_blackouts_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          created_at: string
          cuisine: string
          footprint_m2: number
          gluten_free: boolean
          halal: boolean
          height_m: number
          id: string
          is_addon: boolean
          max_guests: number
          name: string
          needs_400v: boolean
          status: Database["public"]["Enums"]["truck_status"]
          vegan: boolean
        }
        Insert: {
          created_at?: string
          cuisine: string
          footprint_m2: number
          gluten_free?: boolean
          halal?: boolean
          height_m: number
          id?: string
          is_addon?: boolean
          max_guests?: number
          name: string
          needs_400v?: boolean
          status?: Database["public"]["Enums"]["truck_status"]
          vegan?: boolean
        }
        Update: {
          created_at?: string
          cuisine?: string
          footprint_m2?: number
          gluten_free?: boolean
          halal?: boolean
          height_m?: number
          id?: string
          is_addon?: boolean
          max_guests?: number
          name?: string
          needs_400v?: boolean
          status?: Database["public"]["Enums"]["truck_status"]
          vegan?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compliance_status: {
        Args: { _on: string }
        Returns: {
          crew_member: string
          doc_type: string
          expired: boolean
          expires_on: string
          label: string
          truck_id: string
        }[]
      }
      get_booking_by_token: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      respond_to_approval: {
        Args: { _accept: boolean; _reason: string; _token: string }
        Returns: string
      }
      set_booking_status: {
        Args: {
          _id: string
          _note: string
          _status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
      truck_occupancy: {
        Args: { _from: string; _to: string }
        Returns: {
          event_date: string
          truck_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "planner"
      booking_status:
        | "draft"
        | "awaiting_approval"
        | "confirmed"
        | "rejected"
        | "cancelled"
        | "completed"
        | "permit_check"
        | "conflict"
      pair_rule_type:
        | "never_same_day"
        | "never_same_event"
        | "max_one_of_group_on_weekend_day"
        | "allowed_together"
        | "min_clearance_route"
        | "never_assign"
      truck_status: "active" | "retired"
      venue_type: "public_ground" | "private_campus"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff", "planner"],
      booking_status: [
        "draft",
        "awaiting_approval",
        "confirmed",
        "rejected",
        "cancelled",
        "completed",
        "permit_check",
        "conflict",
      ],
      pair_rule_type: [
        "never_same_day",
        "never_same_event",
        "max_one_of_group_on_weekend_day",
        "allowed_together",
        "min_clearance_route",
        "never_assign",
      ],
      truck_status: ["active", "retired"],
      venue_type: ["public_ground", "private_campus"],
    },
  },
} as const
