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
      ai_proposals: {
        Row: {
          confidence: number
          created_at: string
          current_status: Database["public"]["Enums"]["task_status"]
          decision: Database["public"]["Enums"]["proposal_decision"]
          evidence: string
          id: string
          is_sample: boolean
          meeting_id: string
          proposed_status: Database["public"]["Enums"]["task_status"]
          task_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          current_status: Database["public"]["Enums"]["task_status"]
          decision?: Database["public"]["Enums"]["proposal_decision"]
          evidence: string
          id?: string
          is_sample?: boolean
          meeting_id: string
          proposed_status: Database["public"]["Enums"]["task_status"]
          task_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          current_status?: Database["public"]["Enums"]["task_status"]
          decision?: Database["public"]["Enums"]["proposal_decision"]
          evidence?: string
          id?: string
          is_sample?: boolean
          meeting_id?: string
          proposed_status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      board_lists: {
        Row: {
          board_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_lists_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          description: string
          id: string
          is_sample: boolean
          name: string
          series_name: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_sample?: boolean
          name: string
          series_name?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_sample?: boolean
          name?: string
          series_name?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_sample: boolean
          link: string
          platform: Database["public"]["Enums"]["meeting_platform"]
          processed_at: string | null
          series_name: string
          title: string
          transcript: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          is_sample?: boolean
          link: string
          platform: Database["public"]["Enums"]["meeting_platform"]
          processed_at?: string | null
          series_name?: string
          title: string
          transcript?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_sample?: boolean
          link?: string
          platform?: Database["public"]["Enums"]["meeting_platform"]
          processed_at?: string | null
          series_name?: string
          title?: string
          transcript?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: []
      }
      tasks: {
        Row: {
          ai_added: boolean
          created_at: string
          deadline: string | null
          description: string
          dropped_at: string | null
          id: string
          is_sample: boolean
          last_mentioned_meeting_id: string | null
          list_id: string
          owner: string
          position: number
          source_meeting_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          team: string
          title: string
        }
        Insert: {
          ai_added?: boolean
          created_at?: string
          deadline?: string | null
          description?: string
          dropped_at?: string | null
          id?: string
          is_sample?: boolean
          last_mentioned_meeting_id?: string | null
          list_id: string
          owner?: string
          position?: number
          source_meeting_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          team?: string
          title: string
        }
        Update: {
          ai_added?: boolean
          created_at?: string
          deadline?: string | null
          description?: string
          dropped_at?: string | null
          id?: string
          is_sample?: boolean
          last_mentioned_meeting_id?: string | null
          list_id?: string
          owner?: string
          position?: number
          source_meeting_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          team?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_last_mentioned_meeting_id_fkey"
            columns: ["last_mentioned_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "board_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
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
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_status: {
        Args: {
          _status: Database["public"]["Enums"]["member_status"]
          _user_id: string
        }
        Returns: undefined
      }
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      update_my_name: { Args: { _name: string }; Returns: undefined }
      update_task_description: {
        Args: { _description: string; _task_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      meeting_platform: "zoom" | "google_meet" | "teams"
      member_status: "pending" | "approved" | "rejected" | "inactive"
      proposal_decision: "pending" | "approved" | "rejected"
      task_status: "todo" | "in_progress" | "blocked" | "done"
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
      app_role: ["admin", "editor", "viewer"],
      meeting_platform: ["zoom", "google_meet", "teams"],
      member_status: ["pending", "approved", "rejected", "inactive"],
      proposal_decision: ["pending", "approved", "rejected"],
      task_status: ["todo", "in_progress", "blocked", "done"],
    },
  },
} as const
