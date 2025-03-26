import fs from 'fs/promises';
import path from 'path';
export class DocumentImportService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async importDocument(carrierId, filePath) {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);
            
            // Handle the top-level document information
            const { data: docData, error: docError } = await this.supabase
                .rpc('upsert_carrier_document', {
                p_carrier_id: carrierId,
                p_filename: path.basename(filePath),
                p_metadata: jsonData.metadata || {},
                p_total_pages: jsonData.total_pages || 0
            });
            
            if (docError)
                throw docError;
            
            const documentId = docData;
            
            // Process nested documents if they exist
            if (jsonData.documents && Array.isArray(jsonData.documents)) {
                for (const doc of jsonData.documents) {
                    // Process pages for each document
                    if (doc.pages && Array.isArray(doc.pages)) {
                        for (const page of doc.pages) {
                            const { error: pageError } = await this.supabase
                                .rpc('insert_document_page', {
                                p_document_id: documentId,
                                p_page_number: page.page_number,
                                p_content: page.content
                            });
                            if (pageError)
                                throw pageError;
                        }
                    }
                    
                    // Extract and process procedures from each document's pages
                    if (doc.pages) {
                        const procedures = this.extractProcedures(doc.pages);
                        for (const proc of procedures) {
                            const { error: procError } = await this.supabase
                                .rpc('insert_document_procedure', {
                                p_document_id: documentId,
                                p_procedure_code: proc.code,
                                p_description: proc.description,
                                p_submission_requirements: proc.requirements,
                                p_documentation_required: proc.requiresDocumentation
                            });
                            if (procError)
                                throw procError;
                        }
                    }
                }
            }
            // Also check for pages directly at the top level (for backward compatibility)
            else if (jsonData.pages && Array.isArray(jsonData.pages)) {
                for (const page of jsonData.pages) {
                    const { error: pageError } = await this.supabase
                        .rpc('insert_document_page', {
                        p_document_id: documentId,
                        p_page_number: page.page_number,
                        p_content: page.content
                    });
                    if (pageError)
                        throw pageError;
                }
                
                // Extract and process procedures from top-level pages
                const procedures = this.extractProcedures(jsonData.pages);
                for (const proc of procedures) {
                    const { error: procError } = await this.supabase
                        .rpc('insert_document_procedure', {
                        p_document_id: documentId,
                        p_procedure_code: proc.code,
                        p_description: proc.description,
                        p_submission_requirements: proc.requirements,
                        p_documentation_required: proc.requiresDocumentation
                    });
                    if (procError)
                        throw procError;
                }
            }
            
            // Return basic information about the document without fetching it
            return {
                id: documentId,
                carrier_id: carrierId,
                filename: path.basename(filePath),
                total_pages: jsonData.total_pages || 0
            };
        }
        catch (error) {
            console.error('Error importing document:', error);
            throw error;
        }
    }
    extractProcedures(pages) {
        const procedures = [];
        for (const page of pages) {
            const content = page.content;
            const matches = content.match(/D\d{4}/g);
            if (!matches)
                continue;
            for (const code of matches) {
                const codeIndex = content.indexOf(code);
                const nextCodeMatch = content.slice(codeIndex + 5).match(/D\d{4}/);
                const endIndex = nextCodeMatch
                    ? codeIndex + 5 + nextCodeMatch.index
                    : content.length;
                const description = content
                    .slice(codeIndex + 5, endIndex)
                    .trim();
                const requiresDocumentation = content.toLowerCase().includes('documentation required') ||
                    content.toLowerCase().includes('submit documentation');
                const requirementsMatch = content.match(/submission requirements?:?\s*([^]*?)(?=D\d{4}|$)/i);
                const requirements = requirementsMatch ? requirementsMatch[1].trim() : '';
                procedures.push({
                    code,
                    description,
                    requirements,
                    requiresDocumentation
                });
            }
        }
        return procedures;
    }
}
//# sourceMappingURL=DocumentImportService.js.map