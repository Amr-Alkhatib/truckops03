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
      assignments: {
        Row: {
          booking_id: string
          created_at: string
          event_date: string
          id: string
          truck_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          event_date: string
          id?: string
          truck_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          event_date?: string
          id?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
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
          alcohol_served: boolean
          approval_token: string | null
          approver_email: string | null
          approver_name: string | null
          billing_address: string
          clearance_m: number | null
          client_response_reason: string | null
          company_name: string
          conflict_reason: string | null
          contact_mobile: string
          contact_name: string
          county: string | null
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
          permit_fee: number | null
          permit_file_path: string | null
          permit_issued_on: string | null
          permit_number: string | null
          permit_reasons: string[]
          permit_status: string
          po_number: string
          quote: Json
          ref: string
          route_clearance_note: string | null
          route_clearance_status: string
          sales_to_public: boolean
          space_m2: number
          start_time: string
          state: string | null
          status: Database["public"]["Enums"]["booking_status"]
          street_group: string | null
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
          alcohol_served?: boolean
          approval_token?: string | null
          approver_email?: string | null
          approver_name?: string | null
          billing_address: string
          clearance_m?: number | null
          client_response_reason?: string | null
          company_name: string
          conflict_reason?: string | null
          contact_mobile: string
          contact_name: string
          county?: string | null
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
          permit_fee?: number | null
          permit_file_path?: string | null
          permit_issued_on?: string | null
          permit_number?: string | null
          permit_reasons?: string[]
          permit_status?: string
          po_number: string
          quote: Json
          ref?: string
          route_clearance_note?: string | null
          route_clearance_status?: string
          sales_to_public?: boolean
          space_m2: number
          start_time: string
          state?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          street_group?: string | null
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
          alcohol_served?: boolean
          approval_token?: string | null
          approver_email?: string | null
          approver_name?: string | null
          billing_address?: string
          clearance_m?: number | null
          client_response_reason?: string | null
          company_name?: string
          conflict_reason?: string | null
          contact_mobile?: string
          contact_name?: string
          county?: string | null
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
          permit_fee?: number | null
          permit_file_path?: string | null
          permit_issued_on?: string | null
          permit_number?: string | null
          permit_reasons?: string[]
          permit_status?: string
          po_number?: string
          quote?: Json
          ref?: string
          route_clearance_note?: string | null
          route_clearance_status?: string
          sales_to_public?: boolean
          space_m2?: number
          start_time?: string
          state?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          street_group?: string | null
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
          legal_basis: string
          notes: string
          renew_every_months: number | null
          required: boolean
          source_title: string | null
          source_url: string | null
          status: string
          truck_id: string | null
          verified_on: string | null
        }
        Insert: {
          crew_member?: string | null
          doc_type: string
          expires_on?: string | null
          id?: string
          label: string
          legal_basis?: string
          notes?: string
          renew_every_months?: number | null
          required?: boolean
          source_title?: string | null
          source_url?: string | null
          status?: string
          truck_id?: string | null
          verified_on?: string | null
        }
        Update: {
          crew_member?: string | null
          doc_type?: string
          expires_on?: string | null
          id?: string
          label?: string
          legal_basis?: string
          notes?: string
          renew_every_months?: number | null
          required?: boolean
          source_title?: string | null
          source_url?: string | null
          status?: string
          truck_id?: string | null
          verified_on?: string | null
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
      crews: {
        Row: {
          id: string
          members: string[]
          name: string
          notes: string
        }
        Insert: {
          id?: string
          members?: string[]
          name: string
          notes?: string
        }
        Update: {
          id?: string
          members?: string[]
          name?: string
          notes?: string
        }
        Relationships: []
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
          is_system: boolean
          params: Json
          rule_type: Database["public"]["Enums"]["pair_rule_type"]
          system_key: string | null
          truck_ids: string[]
        }
        Insert: {
          active?: boolean
          description?: string
          id?: string
          is_system?: boolean
          params?: Json
          rule_type: Database["public"]["Enums"]["pair_rule_type"]
          system_key?: string | null
          truck_ids: string[]
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          is_system?: boolean
          params?: Json
          rule_type?: Database["public"]["Enums"]["pair_rule_type"]
          system_key?: string | null
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
      staff_notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read: boolean
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          read?: boolean
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      town_checklist: {
        Row: {
          created_at: string
          done: boolean
          id: string
          item: string
          legal_basis: string
          notes: string
          sort: number
          source_url: string | null
          town_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          item: string
          legal_basis?: string
          notes?: string
          sort?: number
          source_url?: string | null
          town_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          item?: string
          legal_basis?: string
          notes?: string
          sort?: number
          source_url?: string | null
          town_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "town_checklist_town_id_fkey"
            columns: ["town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
        ]
      }
      towns: {
        Row: {
          authority_address: string | null
          authority_email: string | null
          authority_name: string | null
          authority_phone: string | null
          auto_created: boolean
          contact: string
          fee_amount: number
          fee_model: string
          fee_table: Json | null
          fee_value: number | null
          generators_allowed: boolean
          id: string
          issuing_authority: string
          landkreis: string | null
          lead_time_weeks: number
          lead_weeks: number | null
          legal_basis: string | null
          max_trucks: number
          min_fee: number | null
          name: string
          night_warn_from: string | null
          notes: string
          permit_name: string
          quiet_hours_mode: string
          quiet_hours_start: string | null
          source_title: string | null
          source_url: string | null
          state: string | null
          status: string
          verified_on: string | null
        }
        Insert: {
          authority_address?: string | null
          authority_email?: string | null
          authority_name?: string | null
          authority_phone?: string | null
          auto_created?: boolean
          contact?: string
          fee_amount?: number
          fee_model?: string
          fee_table?: Json | null
          fee_value?: number | null
          generators_allowed?: boolean
          id?: string
          issuing_authority?: string
          landkreis?: string | null
          lead_time_weeks?: number
          lead_weeks?: number | null
          legal_basis?: string | null
          max_trucks?: number
          min_fee?: number | null
          name: string
          night_warn_from?: string | null
          notes?: string
          permit_name?: string
          quiet_hours_mode?: string
          quiet_hours_start?: string | null
          source_title?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          verified_on?: string | null
        }
        Update: {
          authority_address?: string | null
          authority_email?: string | null
          authority_name?: string | null
          authority_phone?: string | null
          auto_created?: boolean
          contact?: string
          fee_amount?: number
          fee_model?: string
          fee_table?: Json | null
          fee_value?: number | null
          generators_allowed?: boolean
          id?: string
          issuing_authority?: string
          landkreis?: string | null
          lead_time_weeks?: number
          lead_weeks?: number | null
          legal_basis?: string | null
          max_trucks?: number
          min_fee?: number | null
          name?: string
          night_warn_from?: string | null
          notes?: string
          permit_name?: string
          quiet_hours_mode?: string
          quiet_hours_start?: string | null
          source_title?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
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
      truck_crew: {
        Row: {
          crew_id: string
          day_type: string
          id: string
          truck_id: string
        }
        Insert: {
          crew_id: string
          day_type?: string
          id?: string
          truck_id: string
        }
        Update: {
          crew_id?: string
          day_type?: string
          id?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_crew_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_crew_truck_id_fkey"
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
      vat_rates: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          legal_basis: string
          rate: number
          source_title: string | null
          source_url: string | null
          status: string
          valid_from: string
          valid_to: string | null
          verified_on: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label?: string
          legal_basis?: string
          rate: number
          source_title?: string | null
          source_url?: string | null
          status?: string
          valid_from: string
          valid_to?: string | null
          verified_on?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          legal_basis?: string
          rate?: number
          source_title?: string | null
          source_url?: string | null
          status?: string
          valid_from?: string
          valid_to?: string | null
          verified_on?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_day_plan: {
        Args: {
          _actor: string
          _changes: Json
          _date: string
          _new: Json
          _snapshot: string
        }
        Returns: string
      }
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
      confirm_route_clearance: {
        Args: { _id: string; _note: string }
        Returns: string
      }
      day_bookings: {
        Args: { _from: string; _to: string }
        Returns: {
          alcohol_served: boolean
          clearance_m: number
          distance_km: number
          end_time: string
          espresso: boolean
          event_date: string
          gluten_free: number
          guests: number
          halal: number
          has_400v: boolean
          id: string
          locked: boolean
          package: string
          sales_to_public: boolean
          space_m2: number
          start_time: string
          status: string
          street_group: string
          town: string
          truck_ids: string[]
          vegan: number
          venue_type: string
        }[]
      }
      day_snapshot: { Args: { _date: string }; Returns: string }
      get_booking_by_token: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      record_permit: {
        Args: {
          _fee: number
          _file: string
          _id: string
          _issued: string
          _number: string
        }
        Returns: string
      }
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
      set_street_group: {
        Args: { _group: string; _id: string }
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
