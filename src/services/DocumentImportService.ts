import { SupabaseClient } from '@supabase/supabase-js';
import { CarrierDocument } from '../types/documents.js';
import fs from 'fs/promises';
import path from 'path';

export class DocumentImportService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Import a carrier document from a JSON file
   */
  async importDocument(carrierId: string, filePath: string): Promise<CarrierDocument> {
    try {
      // Read and parse the JSON file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const document = JSON.parse(fileContent);

      // Insert the carrier document
      const { data: docData, error: docError } = await this.supabase
        .rpc('upsert_carrier_document', {
          p_carrier_id: carrierId,
          p_filename: path.basename(filePath),
          p_metadata: document.metadata || {},
          p_total_pages: document.total_pages || 0
        });

      if (docError) throw docError;
      const documentId = docData;

      // Insert pages
      if (document.pages && Array.isArray(document.pages)) {
        for (const page of document.pages) {
          const { error: pageError } = await this.supabase
            .rpc('insert_document_page', {
              p_document_id: documentId,
              p_page_number: page.page_number,
              p_content: page.content
            });

          if (pageError) throw pageError;
        }
      }

      // Extract and insert procedures
      if (document.pages) {
        const procedures = this.extractProcedures(document.pages);
        for (const proc of procedures) {
          const { error: procError } = await this.supabase
            .rpc('insert_document_procedure', {
              p_document_id: documentId,
              p_procedure_code: proc.code,
              p_description: proc.description,
              p_submission_requirements: proc.requirements,
              p_documentation_required: proc.requiresDocumentation
            });

          if (procError) throw procError;
        }
      }

      // Return the created document
      const { data: result, error: fetchError } = await this.supabase
        .from('carrier_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;
      return result;

    } catch (error) {
      console.error('Error importing document:', error);
      throw error;
    }
  }

  /**
   * Extract procedures from document pages
   */
  private extractProcedures(pages: any[]): Array<{
    code: string;
    description: string;
    requirements: string;
    requiresDocumentation: boolean;
  }> {
    const procedures: Array<{
      code: string;
      description: string;
      requirements: string;
      requiresDocumentation: boolean;
    }> = [];

    // Iterate through pages to find procedure information
    for (const page of pages) {
      const content = page.content;
      const lines = content.split('\n');
      
      let currentCode = '';
      let currentDescription = '';
      let currentRequirements = '';
      let requiresDocumentation = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for procedure codes (D#### format)
        const codeMatch = line.match(/^D\d{4}\s/);
        if (codeMatch) {
          // If we have a previous procedure, save it
          if (currentCode) {
            procedures.push({
              code: currentCode,
              description: currentDescription.trim(),
              requirements: currentRequirements.trim(),
              requiresDocumentation: requiresDocumentation
            });
          }

          // Start new procedure
          currentCode = codeMatch[0].trim();
          
          // Extract description - everything after the code until Documentation Required or N/A
          const descriptionMatch = line.slice(codeMatch[0].length).split(/Documentation Required|N\/A/)[0];
          currentDescription = descriptionMatch.trim();
          
          // Check documentation requirements
          const docRequiredMatch = line.match(/Documentation Required\s*(.*)/i);
          requiresDocumentation = docRequiredMatch !== null;
          if (docRequiredMatch) {
            currentRequirements = docRequiredMatch[1] || '';
          } else {
            currentRequirements = '';
          }

          // Check next line for continuation of description or requirements
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (!nextLine.match(/^D\d{4}\s/) && nextLine.length > 0) {
              if (nextLine.toLowerCase().includes('documentation required')) {
                const reqMatch = nextLine.match(/Documentation Required\s*(.*)/i);
                requiresDocumentation = true;
                if (reqMatch) {
                  currentRequirements += ' ' + reqMatch[1];
                }
              } else {
                currentDescription += ' ' + nextLine;
              }
            }
          }
        }
      }

      // Don't forget to add the last procedure on the page
      if (currentCode) {
        procedures.push({
          code: currentCode,
          description: currentDescription.trim(),
          requirements: currentRequirements.trim(),
          requiresDocumentation: requiresDocumentation
        });
      }
    }

    return procedures;
  }
} 