import { createClient } from '@supabase/supabase-js';
import { DocumentImportService } from '../services/DocumentImportService.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();
const DOCUMENTS_DIR = path.join(process.cwd(), 'json-files');
const CREATE_CARRIER_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS public.carrier_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  carrier_id BIGINT REFERENCES public.insurance_carriers(id),
  filename TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  total_pages INTEGER DEFAULT 0,
  processed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;
const CREATE_DOCUMENT_PAGES = `
CREATE TABLE IF NOT EXISTS public.document_pages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id BIGINT REFERENCES public.carrier_documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, page_number)
);
`;
const CREATE_DOCUMENT_PROCEDURES = `
CREATE TABLE IF NOT EXISTS public.document_procedures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id BIGINT REFERENCES public.carrier_documents(id) ON DELETE CASCADE,
  procedure_code TEXT NOT NULL,
  description TEXT,
  submission_requirements TEXT,
  documentation_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, procedure_code)
);
`;
const CREATE_UPSERT_DOCUMENT_FUNCTION = `
CREATE OR REPLACE FUNCTION public.upsert_carrier_document(
  p_carrier_id BIGINT,
  p_filename TEXT,
  p_metadata JSONB,
  p_total_pages INTEGER
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  doc_id BIGINT;
BEGIN
  -- Try to find existing document
  SELECT id INTO doc_id
  FROM public.carrier_documents
  WHERE carrier_id = p_carrier_id AND filename = p_filename;
  
  -- If found, update it
  IF doc_id IS NOT NULL THEN
    UPDATE public.carrier_documents
    SET 
      metadata = p_metadata,
      total_pages = p_total_pages,
      processed_date = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = doc_id;
  -- Otherwise insert new record
  ELSE
    INSERT INTO public.carrier_documents (
      carrier_id, filename, metadata, total_pages
    ) VALUES (
      p_carrier_id, p_filename, p_metadata, p_total_pages
    ) RETURNING id INTO doc_id;
  END IF;
  
  RETURN doc_id;
END;
$$;
`;
const CREATE_INSERT_PAGE_FUNCTION = `
CREATE OR REPLACE FUNCTION public.insert_document_page(
  p_document_id BIGINT,
  p_page_number INTEGER,
  p_content TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.document_pages (
    document_id, page_number, content
  ) VALUES (
    p_document_id, p_page_number, p_content
  )
  ON CONFLICT (document_id, page_number) DO UPDATE
  SET content = p_content, updated_at = CURRENT_TIMESTAMP;
END;
$$;
`;
const CREATE_INSERT_PROCEDURE_FUNCTION = `
CREATE OR REPLACE FUNCTION public.insert_document_procedure(
  p_document_id BIGINT,
  p_procedure_code TEXT,
  p_description TEXT,
  p_submission_requirements TEXT,
  p_documentation_required BOOLEAN
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.document_procedures (
    document_id, procedure_code, description, 
    submission_requirements, documentation_required
  ) VALUES (
    p_document_id, p_procedure_code, p_description, 
    p_submission_requirements, p_documentation_required
  )
  ON CONFLICT (document_id, procedure_code) DO UPDATE
  SET 
    description = p_description,
    submission_requirements = p_submission_requirements,
    documentation_required = p_documentation_required,
    updated_at = CURRENT_TIMESTAMP;
  
  EXCEPTION WHEN OTHERS THEN
    -- If the conflict is not due to our unique constraint, try again with a new insertion
    BEGIN
      DELETE FROM public.document_procedures 
      WHERE document_id = p_document_id AND procedure_code = p_procedure_code;
      
      INSERT INTO public.document_procedures (
        document_id, procedure_code, description, 
        submission_requirements, documentation_required
      ) VALUES (
        p_document_id, p_procedure_code, p_description, 
        p_submission_requirements, p_documentation_required
      );
    END;
END;
$$;
`;
async function main() {
    const supabase = createClient(process.env.SUPABASE_URL || 'http://localhost:54321', process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');
    try {
        console.log('Setting up database tables and functions...');
        const baseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
        const apiKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
        async function executeSql(sql) {
            try {
                const response = await axios.post(`${baseUrl}/rest/v1/`, {
                    query: sql
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'apikey': apiKey
                    }
                });
                if (response.status >= 400) {
                    console.warn(`SQL execution warning: ${response.data}`);
                }
            }
            catch (error) {
                console.warn(`SQL execution error: ${error}`);
            }
        }
        await executeSql(CREATE_CARRIER_DOCUMENTS);
        await executeSql(CREATE_DOCUMENT_PAGES);
        await executeSql(CREATE_DOCUMENT_PROCEDURES);
        await executeSql(CREATE_UPSERT_DOCUMENT_FUNCTION);
        await executeSql(CREATE_INSERT_PAGE_FUNCTION);
        await executeSql(CREATE_INSERT_PROCEDURE_FUNCTION);
        console.log('Database setup completed');
        const importService = new DocumentImportService(supabase);
        const files = await fs.readdir(DOCUMENTS_DIR);
        const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));
        console.log(`Found ${jsonFiles.length} JSON files to process`);
        for (const file of jsonFiles) {
            console.log(`Processing ${file}...`);
            try {
                const content = await fs.readFile(path.join(DOCUMENTS_DIR, file), 'utf-8');
                const document = JSON.parse(content);
                const carrierName = document.provider_name;
                if (!carrierName) {
                    console.warn(`Skipping ${file} - no provider_name found`);
                    continue;
                }
                const { data: carriers, error: fetchError } = await supabase
                    .from('insurance_carriers')
                    .select('id')
                    .ilike('carrier_name', carrierName)
                    .limit(1);
                if (fetchError)
                    throw fetchError;
                let carrierId;
                if (carriers && carriers.length > 0) {
                    carrierId = carriers[0].id;
                    console.log(`Found existing carrier: ${carrierName} (ID: ${carrierId})`);
                }
                else {
                    const { data: newCarrier, error: insertError } = await supabase
                        .from('insurance_carriers')
                        .insert({
                        carrier_name: carrierName,
                        carrier_type: 'Other'
                    })
                        .select('id')
                        .single();
                    if (insertError)
                        throw insertError;
                    carrierId = newCarrier.id;
                    console.log(`Created new carrier: ${carrierName} (ID: ${carrierId})`);
                }
                await importService.importDocument(carrierId, path.join(DOCUMENTS_DIR, file));
                console.log(`Successfully imported ${file}`);
            }
            catch (error) {
                console.error(`Error processing ${file}:`, error);
                console.log('Continuing with next file...');
            }
        }
        console.log('All documents imported successfully');
    }
    catch (error) {
        console.error('Error importing documents:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=import-documents.js.map