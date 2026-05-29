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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      test_records: {
        Row: {
          axes_count: number | null
          button_count: number | null
          buttons_passed: number | null
          buttons_tested: number | null
          controller_id: string
          controller_name: string
          controller_type: string
          created_at: string
          deadzone_left: number | null
          deadzone_right: number | null
          id: string
          joystick_drift_left: number | null
          joystick_drift_right: number | null
          latency_avg_ms: number | null
          latency_max_ms: number | null
          overall_score: number | null
          tested_at: string
          vibration_supported: boolean | null
          vibration_tested: boolean | null
        }
        Insert: {
          axes_count?: number | null
          button_count?: number | null
          buttons_passed?: number | null
          buttons_tested?: number | null
          controller_id: string
          controller_name: string
          controller_type: string
          created_at?: string
          deadzone_left?: number | null
          deadzone_right?: number | null
          id?: string
          joystick_drift_left?: number | null
          joystick_drift_right?: number | null
          latency_avg_ms?: number | null
          latency_max_ms?: number | null
          overall_score?: number | null
          tested_at?: string
          vibration_supported?: boolean | null
          vibration_tested?: boolean | null
        }
        Update: {
          axes_count?: number | null
          button_count?: number | null
          buttons_passed?: number | null
          buttons_tested?: number | null
          controller_id?: string
          controller_name?: string
          controller_type?: string
          created_at?: string
          deadzone_left?: number | null
          deadzone_right?: number | null
          id?: string
          joystick_drift_left?: number | null
          joystick_drift_right?: number | null
          latency_avg_ms?: number | null
          latency_max_ms?: number | null
          overall_score?: number | null
          tested_at?: string
          vibration_supported?: boolean | null
          vibration_tested?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      test_records_public: {
        Row: {
          axes_count: number | null
          button_count: number | null
          buttons_passed: number | null
          buttons_tested: number | null
          controller_name: string | null
          controller_type: string | null
          created_at: string | null
          deadzone_left: number | null
          deadzone_right: number | null
          id: string | null
          joystick_drift_left: number | null
          joystick_drift_right: number | null
          latency_avg_ms: number | null
          latency_max_ms: number | null
          overall_score: number | null
          tested_at: string | null
          vibration_supported: boolean | null
          vibration_tested: boolean | null
        }
        Insert: {
          axes_count?: number | null
          button_count?: number | null
          buttons_passed?: number | null
          buttons_tested?: number | null
          controller_name?: string | null
          controller_type?: string | null
          created_at?: string | null
          deadzone_left?: number | null
          deadzone_right?: number | null
          id?: string | null
          joystick_drift_left?: number | null
          joystick_drift_right?: number | null
          latency_avg_ms?: number | null
          latency_max_ms?: number | null
          overall_score?: number | null
          tested_at?: string | null
          vibration_supported?: boolean | null
          vibration_tested?: boolean | null
        }
        Update: {
          axes_count?: number | null
          button_count?: number | null
          buttons_passed?: number | null
          buttons_tested?: number | null
          controller_name?: string | null
          controller_type?: string | null
          created_at?: string | null
          deadzone_left?: number | null
          deadzone_right?: number | null
          id?: string | null
          joystick_drift_left?: number | null
          joystick_drift_right?: number | null
          latency_avg_ms?: number | null
          latency_max_ms?: number | null
          overall_score?: number | null
          tested_at?: string | null
          vibration_supported?: boolean | null
          vibration_tested?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
