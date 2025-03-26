/**
 * Types for document processing
 */

export interface ProcessingState {
  processedFiles: string[];
  lastProcessedTime: string | null;
}

export interface Carrier {
  id: number;
  name: string;
}

export interface DocumentMetadata {
  [key: string]: any;
}

export interface DocumentPage {
  page_number: number;
  content: string;
}

export interface Document {
  filename: string;
  total_pages: number;
  metadata?: DocumentMetadata;
  pages?: DocumentPage[];
}

export interface Procedure {
  code: string;
  description: string;
  requirements: string;
  requiresDocumentation: boolean;
}

export interface DatabaseProcedure {
  document_id: number;
  procedure_code: string;
  description: string;
  submission_requirements: string;
  documentation_required: boolean;
}

export interface CarrierData {
  provider_name: string;
  documents: Document[];
}
