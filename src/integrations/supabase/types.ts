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
      ai_settings: {
        Row: {
          ai_enabled: boolean
          business_hours: string | null
          business_type: string | null
          created_at: string
          farewell: string | null
          focus_mode: string
          forbidden_responses: string | null
          formatting_style: string | null
          general_instructions: string | null
          greeting: string | null
          human_trigger_words: string | null
          id: string
          openai_api_key: string | null
          openai_model: string | null
          tenant_id: string
          tone: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          business_hours?: string | null
          business_type?: string | null
          created_at?: string
          farewell?: string | null
          focus_mode?: string
          forbidden_responses?: string | null
          formatting_style?: string | null
          general_instructions?: string | null
          greeting?: string | null
          human_trigger_words?: string | null
          id?: string
          openai_api_key?: string | null
          openai_model?: string | null
          tenant_id: string
          tone?: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          business_hours?: string | null
          business_type?: string | null
          created_at?: string
          farewell?: string | null
          focus_mode?: string
          forbidden_responses?: string | null
          formatting_style?: string | null
          general_instructions?: string | null
          greeting?: string | null
          human_trigger_words?: string | null
          id?: string
          openai_api_key?: string | null
          openai_model?: string | null
          tenant_id?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          close_time: string
          created_at: string
          day_of_week: number
          enabled: boolean
          id: string
          interval_label: string | null
          open_time: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          created_at?: string
          day_of_week: number
          enabled?: boolean
          id?: string
          interval_label?: string | null
          open_time?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          id?: string
          interval_label?: string | null
          open_time?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_transfers: {
        Row: {
          conversation_id: string
          created_at: string
          from_instance_id: string | null
          id: string
          notes: string | null
          tenant_id: string
          to_instance_id: string
          transferred_by: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_instance_id?: string | null
          id?: string
          notes?: string | null
          tenant_id: string
          to_instance_id: string
          transferred_by: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_instance_id?: string | null
          id?: string
          notes?: string | null
          tenant_id?: string
          to_instance_id?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_transfers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_transfers_from_instance_id_fkey"
            columns: ["from_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_transfers_to_instance_id_fkey"
            columns: ["to_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string
          created_at: string
          id: string
          instance_id: string | null
          kanban_column_id: string | null
          last_message_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          id?: string
          instance_id?: string | null
          kanban_column_id?: string | null
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          kanban_column_id?: string | null
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_kanban_column_id_fkey"
            columns: ["kanban_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      floating_button_settings: {
        Row: {
          active: boolean
          button_color: string
          button_text: string
          created_at: string
          default_message: string
          icon: string
          id: string
          phone: string
          position: string
          show_text: boolean
          text_color: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          button_color?: string
          button_text?: string
          created_at?: string
          default_message?: string
          icon?: string
          id?: string
          phone?: string
          position?: string
          show_text?: boolean
          text_color?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          button_color?: string
          button_text?: string
          created_at?: string
          default_message?: string
          icon?: string
          id?: string
          phone?: string
          position?: string
          show_text?: boolean
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      instance_settings: {
        Row: {
          created_at: string
          debounce_enabled: boolean
          debounce_seconds: number
          fallback_audio: string
          fallback_image: string
          id: string
          instance_id: string
          memory_enabled: boolean
          memory_messages_count: number
          pause_words: string
          resume_words: string
          split_messages_enabled: boolean
          split_messages_limit: number
          tenant_id: string
          typing_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          debounce_enabled?: boolean
          debounce_seconds?: number
          fallback_audio?: string
          fallback_image?: string
          id?: string
          instance_id: string
          memory_enabled?: boolean
          memory_messages_count?: number
          pause_words?: string
          resume_words?: string
          split_messages_enabled?: boolean
          split_messages_limit?: number
          tenant_id: string
          typing_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          debounce_enabled?: boolean
          debounce_seconds?: number
          fallback_audio?: string
          fallback_image?: string
          id?: string
          instance_id?: string
          memory_enabled?: boolean
          memory_messages_count?: number
          pause_words?: string
          resume_words?: string
          split_messages_enabled?: boolean
          split_messages_limit?: number
          tenant_id?: string
          typing_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          content: string | null
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          processing_status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          doc_type?: string
          file_name: string
          file_path: string
          file_size_bytes?: number
          id?: string
          processing_status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          processing_status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          is_ai_generated: boolean
          media_type: string | null
          media_url: string | null
          read_at: string | null
          sent_at: string
          tenant_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          is_ai_generated?: boolean
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sent_at?: string
          tenant_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          is_ai_generated?: boolean
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sent_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          checkout_url: string | null
          created_at: string
          id: string
          max_bots: number
          max_instances: number
          max_messages: number | null
          max_users: number
          name: string
          price_cents: number
          storage_mb: number
          support_level: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          checkout_url?: string | null
          created_at?: string
          id?: string
          max_bots?: number
          max_instances?: number
          max_messages?: number | null
          max_users?: number
          name: string
          price_cents?: number
          storage_mb?: number
          support_level?: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          checkout_url?: string | null
          created_at?: string
          id?: string
          max_bots?: number
          max_instances?: number
          max_messages?: number | null
          max_users?: number
          name?: string
          price_cents?: number
          storage_mb?: number
          support_level?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          id: string
          reminder_key: string
          schedule_id: string
          sent_at: string
          tenant_id: string
        }
        Insert: {
          id?: string
          reminder_key: string
          schedule_id: string
          sent_at?: string
          tenant_id: string
        }
        Update: {
          id?: string
          reminder_key?: string
          schedule_id?: string
          sent_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          message: string | null
          offset_minutes: number
          reminder_key: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          message?: string | null
          offset_minutes?: number
          reminder_key: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          message?: string | null
          offset_minutes?: number
          reminder_key?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          version: string | null
          visible: boolean
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          version?: string | null
          visible?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          version?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      roadmap_votes: {
        Row: {
          created_at: string
          id: string
          roadmap_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          roadmap_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          roadmap_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_votes_roadmap_item_id_fkey"
            columns: ["roadmap_item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["schedule_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["schedule_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_cents: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price_cents?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          auto_trial: boolean
          created_at: string
          detailed_logs: boolean
          email_notifs: boolean
          id: string
          maintenance: boolean
          max_enterprise: number
          max_pro: number
          max_starter: number
          rate_limit: number
          registration: boolean
          timeout: number
          updated_at: string
        }
        Insert: {
          auto_trial?: boolean
          created_at?: string
          detailed_logs?: boolean
          email_notifs?: boolean
          id?: string
          maintenance?: boolean
          max_enterprise?: number
          max_pro?: number
          max_starter?: number
          rate_limit?: number
          registration?: boolean
          timeout?: number
          updated_at?: string
        }
        Update: {
          auto_trial?: boolean
          created_at?: string
          detailed_logs?: boolean
          email_notifs?: boolean
          id?: string
          maintenance?: boolean
          max_enterprise?: number
          max_pro?: number
          max_starter?: number
          rate_limit?: number
          registration?: boolean
          timeout?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          ai_default_enabled: boolean
          created_at: string
          id: string
          language: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_default_enabled?: boolean
          created_at?: string
          id?: string
          language?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_default_enabled?: boolean
          created_at?: string
          id?: string
          language?: string
          theme?: string
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          evolution_instance_id: string | null
          id: string
          instance_name: string
          phone: string | null
          qr_code: string | null
          status: Database["public"]["Enums"]["instance_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evolution_instance_id?: string | null
          id?: string
          instance_name: string
          phone?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evolution_instance_id?: string | null
          id?: string
          instance_name?: string
          phone?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_admins_exist: { Args: never; Returns: boolean }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_maintenance_mode: { Args: never; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      notify_cache_reload: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "member"
      conversation_status: "open" | "closed" | "pending"
      instance_status: "connected" | "disconnected" | "error" | "connecting"
      message_direction: "inbound" | "outbound"
      schedule_status: "pending" | "confirmed" | "cancelled" | "completed"
      subscription_status: "active" | "trial" | "suspended" | "cancelled"
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
      app_role: ["admin", "member"],
      conversation_status: ["open", "closed", "pending"],
      instance_status: ["connected", "disconnected", "error", "connecting"],
      message_direction: ["inbound", "outbound"],
      schedule_status: ["pending", "confirmed", "cancelled", "completed"],
      subscription_status: ["active", "trial", "suspended", "cancelled"],
    },
  },
} as const
