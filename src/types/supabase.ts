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
      guidelines: {
        Row: {
          id: number
          content: string
          content_embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          content: string
          content_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          content?: string
          content_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      match_guidelines: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: Array<{
          id: number
          content: string
          similarity: number
        }>
      }
    }
  }
} 