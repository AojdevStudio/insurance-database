import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Carrier, Document, DocumentPage } from '../types/document';
import { ExtractionService } from './extraction';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/**
 * Database operations for document processing
 */
export class DatabaseOperations {
  private static client: SupabaseClient | null = null;

  /**
   * Get the Supabase client
   * @returns Supabase client instance
   */
  public static getClient(): SupabaseClient {
    if (!this.client) {
      this.client = createClient(supabaseUrl, supabaseKey);
      logger.info('Supabase client initialized');
    }
    return this.client;
  }

  /**
   * Get or create a carrier
   * @param carrierName - The name of the carrier
   * @returns The carrier object
   */
  public static async getOrCreateCarrier(carrierName: string): Promise<Carrier> {
    const supabase = this.getClient();
    logger.info(`Looking up carrier: ${carrierName}`);
    
    // Try to get an existing carrier
    const { data: carrier, error: carrierFetchError } = await supabase
      .from('insurance_carriers')
      .select('id, name')
      .eq('name', carrierName)
      .single();

    // Handle errors except for "no rows returned" error
    if (carrierFetchError && carrierFetchError.code !== 'PGRST116') {
      logger.error(`Error fetching carrier: ${carrierFetchError.message}`);
      throw carrierFetchError;
    }

    // If carrier exists, return it
    if (carrier) {
      logger.info(`Found existing carrier: ${carrierName} (ID: ${carrier.id})`);
      return carrier;
    }

    // Create a new carrier
    logger.info(`Creating new carrier: ${carrierName}`);
    const { data: newCarrier, error: carrierError } = await supabase
      .from('insurance_carriers')
      .insert({ name: carrierName })
      .select()
      .single();

    if (carrierError) {
      logger.error(`Error creating carrier ${carrierName}: ${carrierError.message}`);
      throw new Error(`Error creating carrier ${carrierName}: ${carrierError.message}`);
    }
    
    logger.info(`Created new carrier: ${carrierName} (ID: ${newCarrier.id})`);
    return newCarrier;
  }

  /**
   * Process a document - create or update it and its pages and procedures
   * @param carrier - The carrier the document belongs to
   * @param doc - The document to process
   */
  public static async processDocument(carrier: Carrier, doc: Document): Promise<void> {
    const supabase = this.getClient();
    logger.info(`Processing document: ${doc.filename}`);

    // Check if document exists
    const { data: existingDoc, error: docFetchError } = await supabase
      .from('carrier_documents')
      .select('id')
      .eq('carrier_id', carrier.id)
      .eq('filename', doc.filename)
      .single();

    if (docFetchError && docFetchError.code !== 'PGRST116') {
      logger.error(`Error fetching document: ${docFetchError.message}`);
      throw docFetchError;
    }

    let documentId: number;
    if (existingDoc) {
      logger.info(`Updating existing document: ${doc.filename} (ID: ${existingDoc.id})`);
      documentId = await this.updateDocument(existingDoc.id, doc);
    } else {
      logger.info(`Creating new document: ${doc.filename}`);
      documentId = await this.createDocument(carrier.id, doc);
    }

    if (doc.pages && doc.pages.length > 0) {
      await this.processPages(documentId, doc.pages);
      await this.processProcedures(documentId, doc.pages);
    }
  }

  /**
   * Update an existing document
   * @param docId - The ID of the document to update
   * @param doc - The document data
   * @returns The document ID
   */
  private static async updateDocument(docId: number, doc: Document): Promise<number> {
    const supabase = this.getClient();
    const { error: updateError } = await supabase
      .from('carrier_documents')
      .update({
        metadata: doc.metadata || {},
        total_pages: doc.total_pages || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', docId);

    if (updateError) {
      logger.error(`Error updating document ${doc.filename}: ${updateError.message}`);
      throw new Error(`Error updating document ${doc.filename}: ${updateError.message}`);
    }
    return docId;
  }

  /**
   * Create a new document
   * @param carrierId - The ID of the carrier the document belongs to
   * @param doc - The document data
   * @returns The new document ID
   */
  private static async createDocument(carrierId: number, doc: Document): Promise<number> {
    const supabase = this.getClient();
    const { data: newDoc, error: insertError } = await supabase
      .from('carrier_documents')
      .insert({
        carrier_id: carrierId,
        filename: doc.filename,
        metadata: doc.metadata || {},
        total_pages: doc.total_pages || 0
      })
      .select()
      .single();

    if (insertError) {
      logger.error(`Error inserting document ${doc.filename}: ${insertError.message}`);
      throw new Error(`Error inserting document ${doc.filename}: ${insertError.message}`);
    }
    return newDoc.id;
  }

  /**
   * Process the pages of a document
   * @param documentId - The ID of the document the pages belong to
   * @param pages - The pages to process
   */
  private static async processPages(documentId: number, pages: DocumentPage[]): Promise<void> {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return;

    const supabase = this.getClient();
    logger.info(`Processing ${pages.length} pages for document ID: ${documentId}`);
    
    // Delete existing pages
    const { error: deleteError } = await supabase
      .from('document_pages')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      logger.error(`Error deleting existing pages: ${deleteError.message}`);
      throw new Error(`Error deleting existing pages: ${deleteError.message}`);
    }

    // Batch insert new pages
    const pagesToInsert = pages.map(page => ({
      document_id: documentId,
      page_number: page.page_number,
      content: page.content
    }));

    const { error: insertError } = await supabase
      .from('document_pages')
      .insert(pagesToInsert);

    if (insertError) {
      logger.error(`Error inserting pages: ${insertError.message}`);
      throw new Error(`Error inserting pages: ${insertError.message}`);
    }
    
    logger.info(`Successfully processed ${pages.length} pages`);
  }

  /**
   * Process procedures from document pages
   * @param documentId - The ID of the document the procedures belong to
   * @param pages - The pages to extract procedures from
   */
  private static async processProcedures(documentId: number, pages: DocumentPage[]): Promise<void> {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return;

    const supabase = this.getClient();
    logger.info(`Extracting procedures for document ID: ${documentId}`);
    
    // Delete existing procedures
    const { error: deleteError } = await supabase
      .from('document_procedures')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      logger.error(`Error deleting procedures: ${deleteError.message}`);
      throw new Error(`Error deleting procedures: ${deleteError.message}`);
    }

    // Extract and batch insert new procedures
    const procedures = ExtractionService.extractProcedures(pages);
    
    if (procedures.length === 0) {
      logger.info('No procedures found for document');
      return;
    }
    
    logger.info(`Found ${procedures.length} procedures to insert`);
    
    const proceduresToInsert = procedures.map(proc => ({
      document_id: documentId,
      procedure_code: proc.code,
      description: proc.description,
      submission_requirements: proc.requirements,
      documentation_required: proc.requiresDocumentation
    }));

    const { error: insertError } = await supabase
      .from('document_procedures')
      .insert(proceduresToInsert);

    if (insertError) {
      logger.error(`Error inserting procedures: ${insertError.message}`);
      throw new Error(`Error inserting procedures: ${insertError.message}`);
    }
    
    logger.info(`Successfully processed ${procedures.length} procedures`);
  }
}
