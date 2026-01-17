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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_bot_services: {
        Row: {
          bot_id: string
          created_at: string | null
          error_count: number | null
          id: string
          instant_publish: boolean | null
          is_running: boolean | null
          last_error: string | null
          last_error_at: string | null
          last_generation_started_at: string | null
          last_published_at: string | null
          last_stats_sync: string | null
          mtproto_stats: Json | null
          scraping_stats: Json | null
          service_type: string
          spy_id: string | null
          started_at: string | null
          stats_method: string | null
          subscription_id: string | null
          target_channel: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          error_count?: number | null
          id?: string
          instant_publish?: boolean | null
          is_running?: boolean | null
          last_error?: string | null
          last_error_at?: string | null
          last_generation_started_at?: string | null
          last_published_at?: string | null
          last_stats_sync?: string | null
          mtproto_stats?: Json | null
          scraping_stats?: Json | null
          service_type: string
          spy_id?: string | null
          started_at?: string | null
          stats_method?: string | null
          subscription_id?: string | null
          target_channel: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          error_count?: number | null
          id?: string
          instant_publish?: boolean | null
          is_running?: boolean | null
          last_error?: string | null
          last_error_at?: string | null
          last_generation_started_at?: string | null
          last_published_at?: string | null
          last_stats_sync?: string | null
          mtproto_stats?: Json | null
          scraping_stats?: Json | null
          service_type?: string
          spy_id?: string | null
          started_at?: string | null
          stats_method?: string | null
          subscription_id?: string | null
          target_channel?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_bot_services_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_services_spy_id_fkey"
            columns: ["spy_id"]
            isOneToOne: false
            referencedRelation: "telegram_spies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_services_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean
          session_type: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          session_type: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          session_type?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_settings: {
        Row: {
          created_at: string | null
          free_cooldown_hours: number
          free_duration_minutes: number
          id: string
          is_enabled: boolean
          rental_duration_minutes: number
          rental_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          free_cooldown_hours?: number
          free_duration_minutes?: number
          id?: string
          is_enabled?: boolean
          rental_duration_minutes?: number
          rental_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          free_cooldown_hours?: number
          free_duration_minutes?: number
          id?: string
          is_enabled?: boolean
          rental_duration_minutes?: number
          rental_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_content_sources: {
        Row: {
          ai_bot_service_id: string
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          source_type: string
          source_url: string | null
        }
        Insert: {
          ai_bot_service_id: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          source_type: string
          source_url?: string | null
        }
        Update: {
          ai_bot_service_id?: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          source_type?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_sources_ai_bot_service_id_fkey"
            columns: ["ai_bot_service_id"]
            isOneToOne: false
            referencedRelation: "ai_bot_services"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_posts: {
        Row: {
          ai_bot_service_id: string
          category: string
          content: string
          created_at: string | null
          error_message: string | null
          id: string
          image_url: string | null
          message_id: number | null
          mtproto_stats: Json | null
          published_at: string | null
          reactions: number | null
          scraping_stats: Json | null
          status: string
          updated_at: string | null
          views: number | null
        }
        Insert: {
          ai_bot_service_id: string
          category: string
          content: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          message_id?: number | null
          mtproto_stats?: Json | null
          published_at?: string | null
          reactions?: number | null
          scraping_stats?: Json | null
          status?: string
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          ai_bot_service_id?: string
          category?: string
          content?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          message_id?: number | null
          mtproto_stats?: Json | null
          published_at?: string | null
          reactions?: number | null
          scraping_stats?: Json | null
          status?: string
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_posts_ai_bot_service_id_fkey"
            columns: ["ai_bot_service_id"]
            isOneToOne: false
            referencedRelation: "ai_bot_services"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_publishing_settings: {
        Row: {
          ai_bot_service_id: string
          auto_enhance: boolean | null
          created_at: string | null
          custom_prompt: string | null
          generate_tags: boolean | null
          id: string
          include_media: boolean | null
          post_interval_minutes: number | null
          posts_per_day: number | null
          publish_all: boolean | null
          publish_new_only: boolean | null
          time_from: string | null
          time_to: string | null
          updated_at: string | null
          use_custom_prompt: boolean | null
        }
        Insert: {
          ai_bot_service_id: string
          auto_enhance?: boolean | null
          created_at?: string | null
          custom_prompt?: string | null
          generate_tags?: boolean | null
          id?: string
          include_media?: boolean | null
          post_interval_minutes?: number | null
          posts_per_day?: number | null
          publish_all?: boolean | null
          publish_new_only?: boolean | null
          time_from?: string | null
          time_to?: string | null
          updated_at?: string | null
          use_custom_prompt?: boolean | null
        }
        Update: {
          ai_bot_service_id?: string
          auto_enhance?: boolean | null
          created_at?: string | null
          custom_prompt?: string | null
          generate_tags?: boolean | null
          id?: string
          include_media?: boolean | null
          post_interval_minutes?: number | null
          posts_per_day?: number | null
          publish_all?: boolean | null
          publish_new_only?: boolean | null
          time_from?: string | null
          time_to?: string | null
          updated_at?: string | null
          use_custom_prompt?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_publishing_settings_ai_bot_service_id_fkey"
            columns: ["ai_bot_service_id"]
            isOneToOne: true
            referencedRelation: "ai_bot_services"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_service_settings: {
        Row: {
          api_endpoint: string
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          model_name: string
          provider: string
          service_name: string
          test_last_run: string | null
          test_message: string | null
          test_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint: string
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model_name: string
          provider: string
          service_name: string
          test_last_run?: string | null
          test_message?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model_name?: string
          provider?: string
          service_name?: string
          test_last_run?: string | null
          test_message?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bot_global_stats: {
        Row: {
          bot_id: string
          created_at: string | null
          id: string
          total_channels: number | null
          total_posts: number | null
          total_users: number | null
          updated_at: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          id?: string
          total_channels?: number | null
          total_posts?: number | null
          total_users?: number | null
          updated_at?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          id?: string
          total_channels?: number | null
          total_posts?: number | null
          total_users?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_global_stats_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_services: {
        Row: {
          allow_auto_delete: boolean | null
          allow_custom_watermark: boolean | null
          allow_edit_before_post: boolean | null
          allow_forward_tag: boolean | null
          allow_link_preview: boolean | null
          bot_id: string | null
          created_at: string | null
          error_count: number | null
          id: string
          include_media: boolean | null
          is_running: boolean | null
          keywords_filter: Json | null
          last_error: string | null
          last_error_at: string | null
          last_stats_sync: string | null
          mtproto_stats: Json | null
          post_as_bot: boolean | null
          post_interval_minutes: number | null
          posts_per_day: number | null
          publish_immediately: boolean | null
          publish_old_posts: boolean | null
          scraping_stats: Json | null
          spy_id: string | null
          started_at: string | null
          stats_method: string | null
          subscription_id: string | null
          target_channel: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allow_auto_delete?: boolean | null
          allow_custom_watermark?: boolean | null
          allow_edit_before_post?: boolean | null
          allow_forward_tag?: boolean | null
          allow_link_preview?: boolean | null
          bot_id?: string | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          include_media?: boolean | null
          is_running?: boolean | null
          keywords_filter?: Json | null
          last_error?: string | null
          last_error_at?: string | null
          last_stats_sync?: string | null
          mtproto_stats?: Json | null
          post_as_bot?: boolean | null
          post_interval_minutes?: number | null
          posts_per_day?: number | null
          publish_immediately?: boolean | null
          publish_old_posts?: boolean | null
          scraping_stats?: Json | null
          spy_id?: string | null
          started_at?: string | null
          stats_method?: string | null
          subscription_id?: string | null
          target_channel: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allow_auto_delete?: boolean | null
          allow_custom_watermark?: boolean | null
          allow_edit_before_post?: boolean | null
          allow_forward_tag?: boolean | null
          allow_link_preview?: boolean | null
          bot_id?: string | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          include_media?: boolean | null
          is_running?: boolean | null
          keywords_filter?: Json | null
          last_error?: string | null
          last_error_at?: string | null
          last_stats_sync?: string | null
          mtproto_stats?: Json | null
          post_as_bot?: boolean | null
          post_interval_minutes?: number | null
          posts_per_day?: number | null
          publish_immediately?: boolean | null
          publish_old_posts?: boolean | null
          scraping_stats?: Json | null
          spy_id?: string | null
          started_at?: string | null
          stats_method?: string | null
          subscription_id?: string | null
          target_channel?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_services_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_services_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bot_services_spy"
            columns: ["spy_id"]
            isOneToOne: false
            referencedRelation: "telegram_spies"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_stats: {
        Row: {
          bot_id: string
          created_at: string | null
          id: string
          total_channels: number | null
          total_posts: number | null
          total_published_posts: number | null
          total_users: number | null
          updated_at: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          id?: string
          total_channels?: number | null
          total_posts?: number | null
          total_published_posts?: number | null
          total_users?: number | null
          updated_at?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          id?: string
          total_channels?: number | null
          total_posts?: number | null
          total_published_posts?: number | null
          total_users?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_stats_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      category_prompts: {
        Row: {
          category_key: string | null
          category_name: string
          created_at: string | null
          custom_prompt: string
          emoji: string | null
          id: string
          updated_at: string | null
          use_custom_prompt: boolean | null
        }
        Insert: {
          category_key?: string | null
          category_name: string
          created_at?: string | null
          custom_prompt: string
          emoji?: string | null
          id?: string
          updated_at?: string | null
          use_custom_prompt?: boolean | null
        }
        Update: {
          category_key?: string | null
          category_name?: string
          created_at?: string | null
          custom_prompt?: string
          emoji?: string | null
          id?: string
          updated_at?: string | null
          use_custom_prompt?: boolean | null
        }
        Relationships: []
      }
      channel_stats_history: {
        Row: {
          channel_name: string | null
          created_at: string | null
          id: string
          recorded_at: string | null
          service_id: string
          service_type: string
          subscribers_count: number | null
          total_reactions: number | null
          total_views: number | null
        }
        Insert: {
          channel_name?: string | null
          created_at?: string | null
          id?: string
          recorded_at?: string | null
          service_id: string
          service_type: string
          subscribers_count?: number | null
          total_reactions?: number | null
          total_views?: number | null
        }
        Update: {
          channel_name?: string | null
          created_at?: string | null
          id?: string
          recorded_at?: string | null
          service_id?: string
          service_type?: string
          subscribers_count?: number | null
          total_reactions?: number | null
          total_views?: number | null
        }
        Relationships: []
      }
      cleanup_tracker: {
        Row: {
          id: number
          last_cleanup_at: string | null
          posts_deleted_last_time: number | null
        }
        Insert: {
          id?: number
          last_cleanup_at?: string | null
          posts_deleted_last_time?: number | null
        }
        Update: {
          id?: number
          last_cleanup_at?: string | null
          posts_deleted_last_time?: number | null
        }
        Relationships: []
      }
      faq: {
        Row: {
          answer: string
          answer_en: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          question: string
          question_en: string | null
          updated_at: string | null
        }
        Insert: {
          answer: string
          answer_en?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question: string
          question_en?: string | null
          updated_at?: string | null
        }
        Update: {
          answer?: string
          answer_en?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
          question_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      free_spins: {
        Row: {
          created_at: string | null
          id: string
          notification_shown: boolean
          spins_count: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_shown?: boolean
          spins_count?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_shown?: boolean
          spins_count?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lottery_rounds: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          participants_count: number
          prize_pool: number
          round_number: number
          start_time: string
          status: string
          winner_id: string | null
          winner_prize: number | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          participants_count?: number
          prize_pool?: number
          round_number?: never
          start_time?: string
          status?: string
          winner_id?: string | null
          winner_prize?: number | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          participants_count?: number
          prize_pool?: number
          round_number?: never
          start_time?: string
          status?: string
          winner_id?: string | null
          winner_prize?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_rounds_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_rounds_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_settings: {
        Row: {
          created_at: string
          double_prize_threshold: number
          draw_interval_hours: number
          id: string
          is_enabled: boolean
          ticket_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          double_prize_threshold?: number
          draw_interval_hours?: number
          id?: string
          is_enabled?: boolean
          ticket_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          double_prize_threshold?: number
          draw_interval_hours?: number
          id?: string
          is_enabled?: boolean
          ticket_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      lottery_tickets: {
        Row: {
          id: string
          purchased_at: string
          round_id: string
          ticket_price: number
          user_id: string
        }
        Insert: {
          id?: string
          purchased_at?: string
          round_id: string
          ticket_price?: number
          user_id: string
        }
        Update: {
          id?: string
          purchased_at?: string
          round_id?: string
          ticket_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_tickets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "lottery_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      miner_achievements: {
        Row: {
          achievement_key: string
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          requirement: number
          reward_coins: number
        }
        Insert: {
          achievement_key: string
          category: string
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          requirement: number
          reward_coins: number
        }
        Update: {
          achievement_key?: string
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement?: number
          reward_coins?: number
        }
        Relationships: []
      }
      miner_daily_rewards: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_claim_date: string | null
          total_claims: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_claim_date?: string | null
          total_claims?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_claim_date?: string | null
          total_claims?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      miner_game_data: {
        Row: {
          auto_collect_enabled: boolean | null
          auto_collect_level: number | null
          coins_per_click: number | null
          created_at: string
          energy: number | null
          energy_regen_per_min: number | null
          id: string
          last_auto_collect: string | null
          last_claim: string
          last_energy_update: string | null
          max_energy: number | null
          miners_owned: Json
          storage_level: number | null
          storage_max_hours: number | null
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_collect_enabled?: boolean | null
          auto_collect_level?: number | null
          coins_per_click?: number | null
          created_at?: string
          energy?: number | null
          energy_regen_per_min?: number | null
          id?: string
          last_auto_collect?: string | null
          last_claim?: string
          last_energy_update?: string | null
          max_energy?: number | null
          miners_owned?: Json
          storage_level?: number | null
          storage_max_hours?: number | null
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_collect_enabled?: boolean | null
          auto_collect_level?: number | null
          coins_per_click?: number | null
          created_at?: string
          energy?: number | null
          energy_regen_per_min?: number | null
          id?: string
          last_auto_collect?: string | null
          last_claim?: string
          last_energy_update?: string | null
          max_energy?: number | null
          miners_owned?: Json
          storage_level?: number | null
          storage_max_hours?: number | null
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      miner_user_achievements: {
        Row: {
          achievement_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miner_user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "miner_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          account_login_enabled: boolean | null
          bot_status_enabled: boolean | null
          created_at: string | null
          system_notifications_enabled: boolean | null
          task_moderation_enabled: boolean | null
          ticket_reply_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_login_enabled?: boolean | null
          bot_status_enabled?: boolean | null
          created_at?: string | null
          system_notifications_enabled?: boolean | null
          task_moderation_enabled?: boolean | null
          ticket_reply_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_login_enabled?: boolean | null
          bot_status_enabled?: boolean | null
          created_at?: string | null
          system_notifications_enabled?: boolean | null
          task_moderation_enabled?: boolean | null
          ticket_reply_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_codes: {
        Row: {
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          used?: boolean | null
        }
        Relationships: []
      }
      pending_spy_channels: {
        Row: {
          channel_id: string
          channel_identifier: string
          created_at: string | null
          id: string
          joined_at: string
          should_leave_at: string
          spy_id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          channel_id: string
          channel_identifier: string
          created_at?: string | null
          id?: string
          joined_at?: string
          should_leave_at?: string
          spy_id: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          channel_id?: string
          channel_identifier?: string
          created_at?: string | null
          id?: string
          joined_at?: string
          should_leave_at?: string
          spy_id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_spy_channels_spy_id_fkey"
            columns: ["spy_id"]
            isOneToOne: false
            referencedRelation: "telegram_spies"
            referencedColumns: ["id"]
          },
        ]
      }
      posts_history: {
        Row: {
          bot_service_id: string
          created_at: string | null
          error_message: string | null
          has_media: boolean | null
          id: string
          mtproto_stats: Json | null
          post_content: string | null
          reactions: number | null
          scraping_stats: Json | null
          source_channel: string
          status: string
          target_channel: string
        }
        Insert: {
          bot_service_id: string
          created_at?: string | null
          error_message?: string | null
          has_media?: boolean | null
          id?: string
          mtproto_stats?: Json | null
          post_content?: string | null
          reactions?: number | null
          scraping_stats?: Json | null
          source_channel: string
          status: string
          target_channel: string
        }
        Update: {
          bot_service_id?: string
          created_at?: string | null
          error_message?: string | null
          has_media?: boolean | null
          id?: string
          mtproto_stats?: Json | null
          post_content?: string | null
          reactions?: number | null
          scraping_stats?: Json | null
          source_channel?: string
          status?: string
          target_channel?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_history_bot_service_id_fkey"
            columns: ["bot_service_id"]
            isOneToOne: false
            referencedRelation: "bot_services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          balance: number | null
          bonus_balance: number | null
          bots_used_count: number | null
          channels_used_count: number | null
          created_at: string | null
          email: string | null
          email_verified: boolean | null
          full_name: string | null
          google_id: string | null
          has_entered_referral: boolean | null
          id: string
          phone: string | null
          posts_current_period: number | null
          referral_code: string | null
          referred_by: string | null
          registration_ip: unknown
          role: string | null
          sources_used_count: number | null
          stats_last_updated: string | null
          stats_period_start: string | null
          telegram_id: number | null
          telegram_photo_url: string | null
          telegram_username: string | null
          updated_at: string | null
          user_number: number
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          balance?: number | null
          bonus_balance?: number | null
          bots_used_count?: number | null
          channels_used_count?: number | null
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          google_id?: string | null
          has_entered_referral?: boolean | null
          id: string
          phone?: string | null
          posts_current_period?: number | null
          referral_code?: string | null
          referred_by?: string | null
          registration_ip?: unknown
          role?: string | null
          sources_used_count?: number | null
          stats_last_updated?: string | null
          stats_period_start?: string | null
          telegram_id?: number | null
          telegram_photo_url?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_number?: number
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          balance?: number | null
          bonus_balance?: number | null
          bots_used_count?: number | null
          channels_used_count?: number | null
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          google_id?: string | null
          has_entered_referral?: boolean | null
          id?: string
          phone?: string | null
          posts_current_period?: number | null
          referral_code?: string | null
          referred_by?: string | null
          registration_ip?: unknown
          role?: string | null
          sources_used_count?: number | null
          stats_last_updated?: string | null
          stats_period_start?: string | null
          telegram_id?: number | null
          telegram_photo_url?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_uses: {
        Row: {
          id: string
          promo_code_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          promo_code_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          promo_code_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applicable_tariffs: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          discount_amount: number | null
          discount_percent: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_tariffs?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_amount?: number | null
          discount_percent: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_tariffs?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_amount?: number | null
          discount_percent?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_amount: number | null
          created_at: string | null
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_amount?: number | null
          created_at?: string | null
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_amount?: number | null
          created_at?: string | null
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string | null
          id: string
          is_approved: boolean | null
          rating: number
          text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating: number
          text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating?: number
          text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      site_analytics: {
        Row: {
          created_at: string | null
          date: string
          id: string
          page_views: number | null
          unique_visitors: number | null
          updated_at: string | null
          visits: number | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          page_views?: number | null
          unique_visitors?: number | null
          updated_at?: string | null
          visits?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          page_views?: number | null
          unique_visitors?: number | null
          updated_at?: string | null
          visits?: number | null
        }
        Relationships: []
      }
      source_channels: {
        Row: {
          bot_service_id: string
          channel_title: string | null
          channel_username: string
          created_at: string | null
          id: string
          invite_hash: string | null
          is_active: boolean | null
          is_private: boolean | null
          last_sync_at: string | null
          spammer_id: string | null
          spy_id: string | null
        }
        Insert: {
          bot_service_id: string
          channel_title?: string | null
          channel_username: string
          created_at?: string | null
          id?: string
          invite_hash?: string | null
          is_active?: boolean | null
          is_private?: boolean | null
          last_sync_at?: string | null
          spammer_id?: string | null
          spy_id?: string | null
        }
        Update: {
          bot_service_id?: string
          channel_title?: string | null
          channel_username?: string
          created_at?: string | null
          id?: string
          invite_hash?: string | null
          is_active?: boolean | null
          is_private?: boolean | null
          last_sync_at?: string | null
          spammer_id?: string | null
          spy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_channels_bot_service_id_fkey"
            columns: ["bot_service_id"]
            isOneToOne: false
            referencedRelation: "bot_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_channels_spammer_id_fkey"
            columns: ["spammer_id"]
            isOneToOne: false
            referencedRelation: "telegram_spammers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_channels_spy_id_fkey"
            columns: ["spy_id"]
            isOneToOne: false
            referencedRelation: "telegram_spies"
            referencedColumns: ["id"]
          },
        ]
      }
      source_posts: {
        Row: {
          author_name: string | null
          bot_service_id: string
          created_at: string | null
          forwards_count: number | null
          has_media: boolean | null
          id: string
          is_processed: boolean | null
          is_published: boolean | null
          media_type: string | null
          media_url: string | null
          original_message_id: number
          posted_at: string
          published_at: string | null
          published_message_id: number | null
          source_channel_id: string
          text: string | null
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          author_name?: string | null
          bot_service_id: string
          created_at?: string | null
          forwards_count?: number | null
          has_media?: boolean | null
          id?: string
          is_processed?: boolean | null
          is_published?: boolean | null
          media_type?: string | null
          media_url?: string | null
          original_message_id: number
          posted_at: string
          published_at?: string | null
          published_message_id?: number | null
          source_channel_id: string
          text?: string | null
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          author_name?: string | null
          bot_service_id?: string
          created_at?: string | null
          forwards_count?: number | null
          has_media?: boolean | null
          id?: string
          is_processed?: boolean | null
          is_published?: boolean | null
          media_type?: string | null
          media_url?: string | null
          original_message_id?: number
          posted_at?: string
          published_at?: string | null
          published_message_id?: number | null
          source_channel_id?: string
          text?: string | null
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "source_posts_bot_service_id_fkey"
            columns: ["bot_service_id"]
            isOneToOne: false
            referencedRelation: "ai_bot_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_posts_source_channel_id_fkey"
            columns: ["source_channel_id"]
            isOneToOne: false
            referencedRelation: "source_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      spy_channel_data: {
        Row: {
          channel_data: Json | null
          channel_id: string | null
          channel_title: string | null
          channel_username: string | null
          collected_at: string | null
          id: string
          is_private: boolean | null
          last_post_date: string | null
          members_count: number | null
          posts_count: number | null
          spy_id: string | null
        }
        Insert: {
          channel_data?: Json | null
          channel_id?: string | null
          channel_title?: string | null
          channel_username?: string | null
          collected_at?: string | null
          id?: string
          is_private?: boolean | null
          last_post_date?: string | null
          members_count?: number | null
          posts_count?: number | null
          spy_id?: string | null
        }
        Update: {
          channel_data?: Json | null
          channel_id?: string | null
          channel_title?: string | null
          channel_username?: string | null
          collected_at?: string | null
          id?: string
          is_private?: boolean | null
          last_post_date?: string | null
          members_count?: number | null
          posts_count?: number | null
          spy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spy_channel_data_spy_id_fkey"
            columns: ["spy_id"]
            isOneToOne: false
            referencedRelation: "telegram_spies"
            referencedColumns: ["id"]
          },
        ]
      }
      static_pages: {
        Row: {
          content: string
          content_en: string | null
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean
          show_in_footer: boolean
          slug: string
          title: string
          title_en: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_en?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          show_in_footer?: boolean
          slug: string
          title: string
          title_en?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_en?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          show_in_footer?: boolean
          slug?: string
          title?: string
          title_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          started_at: string | null
          status: string
          tariff_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tariff_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tariff_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          allow_ai_images: boolean | null
          allow_auto_delete: boolean | null
          allow_custom_watermark: boolean | null
          allow_edit_before_post: boolean | null
          allow_forward_tag: boolean | null
          allow_keyword_filter: boolean | null
          allow_link_preview: boolean | null
          allow_media: boolean | null
          allow_new_posts_only: boolean | null
          allow_post_as_channel: boolean | null
          allow_scheduled_posting: boolean | null
          bots_limit: number | null
          channels_limit: number
          created_at: string | null
          description: string | null
          description_en: string | null
          duration_days: number | null
          features: Json | null
          features_list: Json | null
          id: string
          is_active: boolean | null
          is_trial: boolean | null
          name: string
          name_en: string
          posts_per_month: number
          price: number
          sources_limit: number
          trial_bots_limit: number | null
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          allow_ai_images?: boolean | null
          allow_auto_delete?: boolean | null
          allow_custom_watermark?: boolean | null
          allow_edit_before_post?: boolean | null
          allow_forward_tag?: boolean | null
          allow_keyword_filter?: boolean | null
          allow_link_preview?: boolean | null
          allow_media?: boolean | null
          allow_new_posts_only?: boolean | null
          allow_post_as_channel?: boolean | null
          allow_scheduled_posting?: boolean | null
          bots_limit?: number | null
          channels_limit: number
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          duration_days?: number | null
          features?: Json | null
          features_list?: Json | null
          id?: string
          is_active?: boolean | null
          is_trial?: boolean | null
          name: string
          name_en: string
          posts_per_month: number
          price: number
          sources_limit?: number
          trial_bots_limit?: number | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_ai_images?: boolean | null
          allow_auto_delete?: boolean | null
          allow_custom_watermark?: boolean | null
          allow_edit_before_post?: boolean | null
          allow_forward_tag?: boolean | null
          allow_keyword_filter?: boolean | null
          allow_link_preview?: boolean | null
          allow_media?: boolean | null
          allow_new_posts_only?: boolean | null
          allow_post_as_channel?: boolean | null
          allow_scheduled_posting?: boolean | null
          bots_limit?: number | null
          channels_limit?: number
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          duration_days?: number | null
          features?: Json | null
          features_list?: Json | null
          id?: string
          is_active?: boolean | null
          is_trial?: boolean | null
          name?: string
          name_en?: string
          posts_per_month?: number
          price?: number
          sources_limit?: number
          trial_bots_limit?: number | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_submissions: {
        Row: {
          created_at: string
          id: string
          report_text: string | null
          review_comment: string | null
          reviewed_at: string | null
          screenshot_url: string | null
          started_at: string
          status: string
          submitted_at: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_text?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          screenshot_url?: string | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_text?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          screenshot_url?: string | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          additional_links: string[] | null
          available_executions: number | null
          balance_type: string | null
          budget: number
          category: string | null
          channel_info: Json | null
          completed_count: number
          created_at: string
          description: string
          id: string
          images: string[] | null
          max_completions: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_comment: string | null
          rejection_reason: string | null
          requires_screenshot: boolean
          reward_amount: number
          status: string
          task_type: string
          telegram_channel_link: string | null
          time_limit_hours: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_links?: string[] | null
          available_executions?: number | null
          balance_type?: string | null
          budget?: number
          category?: string | null
          channel_info?: Json | null
          completed_count?: number
          created_at?: string
          description: string
          id?: string
          images?: string[] | null
          max_completions?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_comment?: string | null
          rejection_reason?: string | null
          requires_screenshot?: boolean
          reward_amount: number
          status?: string
          task_type: string
          telegram_channel_link?: string | null
          time_limit_hours: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_links?: string[] | null
          available_executions?: number | null
          balance_type?: string | null
          budget?: number
          category?: string | null
          channel_info?: Json | null
          completed_count?: number
          created_at?: string
          description?: string
          id?: string
          images?: string[] | null
          max_completions?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_comment?: string | null
          rejection_reason?: string | null
          requires_screenshot?: boolean
          reward_amount?: number
          status?: string
          task_type?: string
          telegram_channel_link?: string | null
          time_limit_hours?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bots: {
        Row: {
          bot_name: string | null
          bot_token: string
          bot_type: Database["public"]["Enums"]["bot_type_enum"] | null
          bot_username: string | null
          channels_count: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          posts_count: number | null
          status: string | null
          updated_at: string | null
          user_id: string
          users_count: number | null
          webhook_url: string | null
        }
        Insert: {
          bot_name?: string | null
          bot_token: string
          bot_type?: Database["public"]["Enums"]["bot_type_enum"] | null
          bot_username?: string | null
          channels_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          posts_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          users_count?: number | null
          webhook_url?: string | null
        }
        Update: {
          bot_name?: string | null
          bot_token?: string
          bot_type?: Database["public"]["Enums"]["bot_type_enum"] | null
          bot_username?: string | null
          channels_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          posts_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          users_count?: number | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_bots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_spammers: {
        Row: {
          authkey: string | null
          created_at: string | null
          error_count: number | null
          id: string
          is_active: boolean | null
          is_authorized: boolean | null
          last_activity_at: string | null
          last_error: string | null
          messages_sent: number | null
          name: string
          phone_number: string | null
          tdata_path: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          authkey?: string | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          last_activity_at?: string | null
          last_error?: string | null
          messages_sent?: number | null
          name: string
          phone_number?: string | null
          tdata_path: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          authkey?: string | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          last_activity_at?: string | null
          last_error?: string | null
          messages_sent?: number | null
          name?: string
          phone_number?: string | null
          tdata_path?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_spies: {
        Row: {
          api_hash: string
          api_id: string
          channels_monitored: number | null
          created_at: string | null
          error_count: number | null
          id: string
          is_active: boolean | null
          is_authorized: boolean | null
          last_activity_at: string | null
          last_error: string | null
          name: string | null
          phone_number: string | null
          session_string: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_hash: string
          api_id: string
          channels_monitored?: number | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          last_activity_at?: string | null
          last_error?: string | null
          name?: string | null
          phone_number?: string | null
          session_string?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_hash?: string
          api_id?: string
          channels_monitored?: number | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          last_activity_at?: string | null
          last_error?: string | null
          name?: string | null
          phone_number?: string | null
          session_string?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          message_id: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          message_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          message_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          unread_admin_replies: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          unread_admin_replies?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          unread_admin_replies?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_settings: {
        Row: {
          created_at: string | null
          display_order: number
          free_cooldown_hours: number | null
          free_duration_minutes: number | null
          id: string
          is_enabled: boolean
          price: number | null
          rental_duration_minutes: number | null
          tool_description: string
          tool_key: string
          tool_name: string
          updated_at: string | null
          vip_discount_enabled: boolean | null
          vip_discount_percent: number | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          free_cooldown_hours?: number | null
          free_duration_minutes?: number | null
          id?: string
          is_enabled?: boolean
          price?: number | null
          rental_duration_minutes?: number | null
          tool_description: string
          tool_key: string
          tool_name: string
          updated_at?: string | null
          vip_discount_enabled?: boolean | null
          vip_discount_percent?: number | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          free_cooldown_hours?: number | null
          free_duration_minutes?: number | null
          id?: string
          is_enabled?: boolean
          price?: number | null
          rental_duration_minutes?: number | null
          tool_description?: string
          tool_key?: string
          tool_name?: string
          updated_at?: string | null
          vip_discount_enabled?: boolean | null
          vip_discount_percent?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_chat_messages: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      vip_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      wheel_spins: {
        Row: {
          created_at: string
          id: string
          prize_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prize_amount: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prize_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wheel_spins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheel_spins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      miner_game_leaderboard: {
        Row: {
          bonus_balance: number | null
          created_at: string | null
          full_name: string | null
          miners_owned: Json | null
          telegram_username: string | null
          total_earned: number | null
          user_id: string | null
        }
        Relationships: []
      }
      referral_lookup: {
        Row: {
          full_name: string | null
          id: string | null
          referral_code: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          referral_code?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          referral_code?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_task_budget: {
        Args: { amount: number; task_id_param: string }
        Returns: undefined
      }
      add_task_budget_from_bonus: {
        Args: { amount: number; task_id_param: string }
        Returns: undefined
      }
      add_task_budget_from_main: {
        Args: { amount: number; task_id_param: string }
        Returns: undefined
      }
      apply_referral_code: {
        Args: { p_referral_code: string; p_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      approve_task_submission: {
        Args: { reward: number; submission_id: string }
        Returns: undefined
      }
      auto_collect_earnings: { Args: never; Returns: undefined }
      auto_draw_lottery: { Args: never; Returns: undefined }
      calculate_bot_uptime: { Args: { bot_id: string }; Returns: number }
      can_start_free_ai_chat_session: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_channel_ownership: {
        Args: { channel_identifier: string; current_user_id?: string }
        Returns: Json
      }
      cleanup_old_ai_posts: { Args: never; Returns: undefined }
      cleanup_old_posts_history: { Args: never; Returns: undefined }
      cleanup_old_transactions: { Args: never; Returns: undefined }
      create_bot_error_notification: {
        Args: {
          p_bot_name: string
          p_channel_name: string
          p_error_message: string
          p_service_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_bot_started_notification: {
        Args: {
          p_bot_name: string
          p_channel_name: string
          p_service_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      deduct_balance: {
        Args: { amount: number; balance_type?: string; user_id: string }
        Returns: boolean
      }
      draw_lottery_winner: { Args: { p_round_id: string }; Returns: Json }
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      expire_ai_chat_sessions: { Args: never; Returns: undefined }
      force_cleanup_old_posts: { Args: never; Returns: Json }
      generate_referral_code: { Args: never; Returns: string }
      get_next_free_ai_chat_time: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_unprocessed_posts_count: {
        Args: { service_id: string }
        Returns: number
      }
      get_unread_notifications_count: { Args: never; Returns: number }
      get_user_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_referral: {
        Args: { _code: string }
        Returns: {
          full_name: string
          id: string
          referral_code: string
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      mark_ticket_as_read: { Args: { ticket_id: string }; Returns: undefined }
      miner_manual_click: { Args: { p_user_id: string }; Returns: Json }
      purchase_lottery_ticket: { Args: never; Returns: Json }
      recalculate_bot_global_stats: {
        Args: never
        Returns: {
          bot_id: string
          channels: number
          posts: number
          users: number
        }[]
      }
      recalculate_posts_current_period: {
        Args: { user_id_param: string }
        Returns: number
      }
      reset_user_posts_stats: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      update_bonus_balance: {
        Args: { amount: number; user_id: string }
        Returns: Json
      }
      update_bot_statistics: { Args: { bot_id: string }; Returns: undefined }
      update_miner_energy: { Args: { p_user_id: string }; Returns: Json }
      update_user_stats: { Args: { user_id_param: string }; Returns: undefined }
      upgrade_miner_storage: { Args: never; Returns: Json }
      validate_promo_code: {
        Args: { p_code: string; p_tariff_id: string; p_user_id?: string }
        Returns: {
          discount_amount: number
          discount_percent: number
          is_valid: boolean
          message: string
        }[]
      }
      withdraw_task_budget: {
        Args: { amount: number; task_id_param: string }
        Returns: undefined
      }
      withdraw_task_budget_to_main: {
        Args: { amount: number; task_id_param: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      bot_type_enum: "ai" | "plagiarist"
      notification_type:
        | "task_submission"
        | "task_approved"
        | "task_rejected"
        | "ticket_reply"
        | "system_announcement"
        | "balance_change"
        | "account_login"
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
      app_role: ["admin", "user", "moderator"],
      bot_type_enum: ["ai", "plagiarist"],
      notification_type: [
        "task_submission",
        "task_approved",
        "task_rejected",
        "ticket_reply",
        "system_announcement",
        "balance_change",
        "account_login",
      ],
    },
  },
} as const
