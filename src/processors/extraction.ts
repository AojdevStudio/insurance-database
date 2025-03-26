import { DocumentPage, Procedure } from '../types/document';

/**
 * Service for extracting procedures from document pages
 */
export class ExtractionService {
  private static readonly CODE_PATTERN = /\b(D\d{4})\b/g;
  private static readonly DOC_REQUIRED_PATTERN = /\b(?:documentation\s+required|documentation\s+needed)\b/i;

  /**
   * Extract procedures from document pages
   * @param pages - Array of document pages
   * @returns Array of extracted procedures
   */
  public static extractProcedures(pages: DocumentPage[]): Procedure[] {
    const procedures = new Map<string, Procedure>(); // Use Map to deduplicate procedures by code
    
    if (!pages || !Array.isArray(pages)) {
      return [];
    }
    
    for (const page of pages) {
      const content = page.content;
      const lines = content.split('\n');
      
      let currentProcedure: Procedure | null = null;
      let buffer: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Look for procedure codes
        const codeMatch = trimmedLine.match(this.CODE_PATTERN);
        
        if (codeMatch) {
          // Save previous procedure if exists
          if (currentProcedure) {
            this.finalizeProcedure(currentProcedure, buffer, procedures);
          }

          // Start new procedure
          currentProcedure = {
            code: codeMatch[0],
            description: '',
            requirements: '',
            requiresDocumentation: false
          };
          
          // Remove code from line for further processing
          buffer = [trimmedLine.replace(this.CODE_PATTERN, '').trim()];
        } else if (currentProcedure) {
          // Check if line contains documentation requirements
          if (this.DOC_REQUIRED_PATTERN.test(trimmedLine)) {
            currentProcedure.requiresDocumentation = true;
            const reqContent = trimmedLine.replace(this.DOC_REQUIRED_PATTERN, '').trim();
            if (reqContent) {
              currentProcedure.requirements = reqContent;
            }
          } else if (!trimmedLine.match(/^D\d{4}\s/)) {
            // Add line to buffer if it's not a new procedure code
            buffer.push(trimmedLine);
          }
        }
      }

      // Don't forget to save the last procedure
      if (currentProcedure) {
        this.finalizeProcedure(currentProcedure, buffer, procedures);
      }
    }

    return Array.from(procedures.values());
  }

  /**
   * Finalize a procedure by processing the collected text
   * @param procedure - The procedure to finalize
   * @param buffer - Buffer of text lines
   * @param procedures - Map of procedures
   */
  private static finalizeProcedure(
    procedure: Procedure, 
    buffer: string[], 
    procedures: Map<string, Procedure>
  ): void {
    // Join buffer lines and clean up the text
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
    
    // Split text into description and requirements if not already set
    if (!procedure.requirements && text.toLowerCase().includes('documentation required')) {
      const [desc, ...reqs] = text.split(/documentation required/i);
      procedure.description = desc.trim();
      procedure.requirements = reqs.join(' ').trim();
      procedure.requiresDocumentation = true;
    } else if (!procedure.requirements) {
      procedure.description = text;
    }

    // Store in map, potentially overwriting duplicate codes with better data
    if (procedure.description || procedure.requirements) {
      procedures.set(procedure.code, procedure);
    }
  }
}
