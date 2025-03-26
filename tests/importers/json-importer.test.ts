import { describe, it, expect } from '@jest/globals';
import { JsonImporter } from '../../src/importers/json-importer.js';
import fs from 'fs/promises';
import path from 'path';

describe('JsonImporter', () => {
  it('should successfully import and validate ADDP.json', async () => {
    // Read the ADDP.json file
    const jsonContent = await fs.readFile(path.join(process.cwd(), 'json-files', 'ADDP.json'), 'utf-8');
    
    // Import and validate the document
    const carrierDocument = await JsonImporter.importCarrierDocument(jsonContent);
    
    // Verify the document structure
    expect(carrierDocument.provider_name).toBe('ADDP');
    expect(carrierDocument.total_documents).toBe(6);
    expect(Array.isArray(carrierDocument.documents)).toBe(true);
    expect(carrierDocument.documents.length).toBeGreaterThan(0);
    
    // Verify the first document
    const firstDoc = carrierDocument.documents[0];
    expect(firstDoc.filename).toBe('ADDP Benefit Details Document.pdf');
    expect(firstDoc.total_pages).toBeGreaterThan(0);
    expect(Array.isArray(firstDoc.pages)).toBe(true);
    expect(firstDoc.pages.length).toBeGreaterThan(0);
    
    // Verify the first page
    const firstPage = firstDoc.pages[0];
    expect(firstPage.page_number).toBe(1);
    expect(typeof firstPage.content).toBe('string');
    expect(firstPage.content.length).toBeGreaterThan(0);
  });
}); 