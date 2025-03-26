import { z } from 'zod';

// Define the carrier JSON schema using zod
export const CarrierJSONSchema = z.object({
  carrier_name: z.string().min(1).max(100),
  carrier_type: z.enum(['National', 'Medicare Advantage', 'TPA', 'Other']),
  payer_id: z.string().nullable(),
  claims_address: z.string().nullable(),
  phone_number: z.string().nullable(),
  networks: z.array(z.object({
    network_name: z.string().min(1).max(100),
    plan_type: z.enum(['PPO', 'HMO', 'EPO']),
    effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })),
  procedures: z.array(z.object({
    code: z.string(),
    description: z.string(),
    requirements: z.array(z.string())
  })).optional(),
  guidelines: z.array(z.object({
    title: z.string(),
    content: z.string(),
    effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })).optional(),
  appeal_procedures: z.object({
    first_level: z.string(),
    second_level: z.string().optional(),
    external_review: z.string().optional()
  }).optional()
});

// Infer TypeScript types from the schema
export type CarrierJSON = z.infer<typeof CarrierJSONSchema>;

// Export validation error type
export interface JSONValidationError {
  path: string[];
  message: string;
}

// Export validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: JSONValidationError[];
  data?: CarrierJSON;
}

export interface Carrier {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Page {
  page_number: number;
  content: string;
}

export interface Metadata {
  "/CreationDate"?: string;
  "/ModDate"?: string;
  [key: string]: string | undefined;
}

export interface Document {
  filename: string;
  metadata: Metadata;
  total_pages: number;
  pages: Page[];
}

export interface CarrierDocument {
  provider_name: string;
  processed_date: string;
  total_documents: number;
  documents: Document[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
} 