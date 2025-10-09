/**
 * Supabase Database Types
 * 
 * This file contains TypeScript types for your Supabase database schema.
 * These types provide autocomplete and type safety when working with Supabase.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      shows: {
        Row: {
          id: string
          title: string
          location: string
          address: string
          start_date: string
          end_date: string
          entry_fee: number | null
          description: string | null
          status: string
          coordinates: string | null
          scraped_organizer_name: string | null
          scraped_organizer_email: string | null
          scraped_organizer_phone: string | null
          features: Json
          categories: string[]
          confidence_score: number | null
          source_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          location: string
          address: string
          start_date: string
          end_date: string
          entry_fee?: number | null
          description?: string | null
          status?: string
          coordinates?: string | null
          scraped_organizer_name?: string | null
          scraped_organizer_email?: string | null
          scraped_organizer_phone?: string | null
          features?: Json
          categories?: string[]
          confidence_score?: number | null
          source_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          location?: string
          address?: string
          start_date?: string
          end_date?: string
          entry_fee?: number | null
          description?: string | null
          status?: string
          coordinates?: string | null
          scraped_organizer_name?: string | null
          scraped_organizer_email?: string | null
          scraped_organizer_phone?: string | null
          features?: Json
          categories?: string[]
          confidence_score?: number | null
          source_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      scraper_jobs: {
        Row: {
          id: string
          job_name: string
          status: string
          started_at: string
          completed_at: string | null
          duration_seconds: number | null
          shows_scraped: number
          shows_processed: number
          shows_inserted: number
          shows_failed: number
          source_url: string | null
          source_domain: string | null
          error_message: string | null
          error_details: Json | null
          execution_log: string[] | null
          triggered_by: string | null
          config: Json | null
        }
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          role: string
          created_at: string
          updated_at: string
        }
      }
    }
    Views: {
      v_scraper_activity: {
        Row: {
          id: string
          job_name: string
          status: string
          started_at: string
          completed_at: string | null
          duration_seconds: number | null
          shows_scraped: number
          shows_inserted: number
          shows_failed: number
          source_domain: string | null
          triggered_by: string | null
          error_message: string | null
          success_rate_pct: number | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
