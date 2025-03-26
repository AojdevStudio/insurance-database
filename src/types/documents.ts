import { Database } from './supabase';

export interface CarrierDocument {
  id: string;
  carrier_id: string;
  filename: string;
  metadata: {
    [key: string]: any;
  };
  total_pages: number;
  processed_date: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  page_number: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentProcedure {
  id: string;
  document_id: string;
  procedure_code: string;
  description: string | null;
  submission_requirements: string | null;
  documentation_required: boolean;
  created_at: string;
  updated_at: string;
}

export type Tables = Database['public']['Tables'];
export type CarrierDocuments = Tables['carrier_documents']['Row'];
export type DocumentPages = Tables['document_pages']['Row'];
export type DocumentProcedures = Tables['document_procedures']['Row']; 