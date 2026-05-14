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
      attendance: {
        Row: {
          attended: boolean
          created_at: string
          id: string
          notes: string | null
          session_date: string
          slot_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
          slot_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      client_slots: {
        Row: {
          created_at: string
          id: string
          slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_slots_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          video_url: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
          video_url?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      content_completions: {
        Row: {
          completed_at: string
          content_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          content_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          content_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_completions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_fulfillment: {
        Row: {
          created_at: string
          id: string
          shipped_at: string | null
          shipping_address: string | null
          status: Database["public"]["Enums"]["fulfillment_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shipped_at?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shipped_at?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          user_id?: string
        }
        Relationships: []
      }
      intake_forms: {
        Row: {
          goals: string | null
          health_history: string | null
          id: string
          injuries: string | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          goals?: string | null
          health_history?: string | null
          id?: string
          injuries?: string | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          goals?: string | null
          health_history?: string | null
          id?: string
          injuries?: string | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          includes_mornings: boolean
          price_per_month: number
          sessions_per_week: number | null
          stripe_price_id: string | null
          type: Database["public"]["Enums"]["plan_type"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          includes_mornings?: boolean
          price_per_month: number
          sessions_per_week?: number | null
          stripe_price_id?: string | null
          type: Database["public"]["Enums"]["plan_type"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          includes_mornings?: boolean
          price_per_month?: number
          sessions_per_week?: number | null
          stripe_price_id?: string | null
          type?: Database["public"]["Enums"]["plan_type"]
        }
        Relationships: []
      }
      slots: {
        Row: {
          capacity: number
          created_at: string
          day_of_week: number
          id: string
          session_type: Database["public"]["Enums"]["session_type"]
          time: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          day_of_week: number
          id?: string
          session_type: Database["public"]["Enums"]["session_type"]
          time: string
        }
        Update: {
          capacity?: number
          created_at?: string
          day_of_week?: number
          id?: string
          session_type?: Database["public"]["Enums"]["session_type"]
          time?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          start_date: string
          status: string
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          onboarding_complete: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          onboarding_complete?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          onboarding_complete?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      waivers: {
        Row: {
          content_snapshot: string
          id: string
          ip_address: string | null
          signed_at: string
          user_id: string
        }
        Insert: {
          content_snapshot: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          user_id: string
        }
        Update: {
          content_snapshot?: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      fulfillment_status: "pending" | "shipped"
      plan_type: "mornings" | "semi_private" | "private" | "combo"
      session_type: "semi_private" | "private"
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
      app_role: ["admin", "client"],
      fulfillment_status: ["pending", "shipped"],
      plan_type: ["mornings", "semi_private", "private", "combo"],
      session_type: ["semi_private", "private"],
    },
  },
} as const
