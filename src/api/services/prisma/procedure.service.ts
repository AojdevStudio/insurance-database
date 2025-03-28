/**
 * Prisma-based implementation of the ProcedureService
 * Handles CRUD operations and searches for dental procedures
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { 
  IProcedure, 
  IProcedureSearchQuery, 
  IProcedureWithRequirements 
} from '../../types/procedure.js';

export class PrismaProcedureService {
  /**
   * List procedures with pagination, sorting, and optional category filtering
   * @param options Query parameters for pagination, sorting, and filtering
   * @returns Paginated list of procedures with metadata
   */
  static async listProcedures(options: IProcedureSearchQuery = {}) {
    const {
      page = 1,
      limit = 10,
      sort_by = 'code',
      sort_order = 'asc',
      category
    } = options;

    // Ensure numeric types
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build where clause for filtering
      const where: Prisma.ProcedureWhereInput = {};
      
      // Apply category filter if provided
      if (category) {
        where.category = category;
      }

      // Get total count of procedures with applied filters
      const total = await prisma.procedure.count({ where });

      // Validate sort_by field (to prevent injection)
      const validSortFields = ['id', 'code', 'description', 'category', 'created_at'];
      const sortField = validSortFields.includes(String(sort_by)) 
        ? String(sort_by) 
        : 'code';

      // Get paginated procedures
      const procedures = await prisma.procedure.findMany({
        where,
        skip: offset,
        take: limitNum,
        orderBy: {
          [sortField]: sort_order === 'asc' ? 'asc' : 'desc'
        }
      });

      // Map Prisma model to application interface
      const mappedProcedures: IProcedure[] = procedures.map(procedure => ({
        id: procedure.id as number,
        code: procedure.code,
        description: procedure.description,
        category: procedure.category,
        created_at: procedure.created_at || new Date()
      }));

      return {
        procedures: mappedProcedures,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        console.error('Prisma validation error:', error.message);
        throw new Error('Invalid data provided');
      } else {
        console.error('Error listing procedures:', error);
        throw error;
      }
    }
  }

  /**
   * Search procedures by code or description with pagination, sorting, and optional category filtering
   * @param options Search query, pagination, sorting, and filtering parameters
   * @returns Paginated search results with metadata
   */
  static async searchProcedures(options: IProcedureSearchQuery = {}) {
    const {
      query = '',
      page = 1,
      limit = 10,
      sort_by = 'code',
      sort_order = 'asc',
      category
    } = options;

    // Ensure numeric types
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Define search criteria
      const where: Prisma.ProcedureWhereInput = {
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      };

      // Apply category filter if provided
      if (category) {
        where.category = category;
      }

      // Get total count for search results
      const total = await prisma.procedure.count({ where });

      // Validate sort_by field (to prevent injection)
      const validSortFields = ['id', 'code', 'description', 'category', 'created_at'];
      const sortField = validSortFields.includes(String(sort_by)) 
        ? String(sort_by) 
        : 'code';

      // Get paginated search results
      const procedures = await prisma.procedure.findMany({
        where,
        skip: offset,
        take: limitNum,
        orderBy: {
          [sortField]: sort_order === 'asc' ? 'asc' : 'desc'
        }
      });

      // Map Prisma model to application interface
      const mappedProcedures: IProcedure[] = procedures.map(procedure => ({
        id: procedure.id as number,
        code: procedure.code,
        description: procedure.description,
        category: procedure.category,
        created_at: procedure.created_at || new Date()
      }));

      return {
        procedures: mappedProcedures,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        console.error('Prisma validation error:', error.message);
        throw new Error('Invalid data provided');
      } else {
        console.error('Error searching procedures:', error);
        throw error;
      }
    }
  }

  /**
   * Get a single procedure by code, including requirements
   * @param code Procedure code
   * @returns Procedure with carrier and documentation requirements
   */
  static async getProcedureByCode(code: string): Promise<IProcedureWithRequirements> {
    try {
      // Get procedure details
      const procedure = await prisma.procedure.findUnique({
        where: { code },
        include: {
          carrierProcedureRequirements: true,
          documentationRequirements: true
        }
      });

      if (!procedure) {
        throw new Error('Procedure not found');
      }

      // Map Prisma model to application interface
      return {
        id: procedure.id as number,
        code: procedure.code,
        description: procedure.description,
        category: procedure.category,
        created_at: procedure.created_at || new Date(),
        carrier_requirements: procedure.carrierProcedureRequirements.map(req => ({
          id: req.id as number,
          procedure_id: req.procedure_id as number,
          carrier_id: req.carrier_id as number,
          requirement_type: req.requirement_type,
          requirement_value: req.requirement_value,
          created_at: req.created_at || new Date()
        })),
        documentation_requirements: procedure.documentationRequirements.map(req => ({
          id: req.id as number,
          procedure_id: req.procedure_id as number,
          requirement: req.requirement,
          required: req.required,
          created_at: req.created_at || new Date()
        }))
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // P2025 is "Record not found"
          throw new Error('Procedure not found');
        }
        console.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        console.error('Prisma validation error:', error.message);
        throw new Error('Invalid procedure code provided');
      } else {
        // Re-throw the error if it's already a custom error (like "Procedure not found")
        if (error instanceof Error && error.message === 'Procedure not found') {
          throw error;
        }
        console.error('Error getting procedure by code:', error);
        throw error;
      }
    }
  }

  /**
   * Get procedure requirements for a specific code, optionally filtered by carrier
   * @param code Procedure code
   * @param carrierId Optional carrier ID to filter requirements
   * @returns Array of procedure requirements
   */
  static async getProcedureRequirements(code: string, carrierId?: number) {
    try {
      // Build where clause for the procedure requirements view
      const where: Prisma.ProcedureRequirementsViewWhereInput = {
        procedure_code: code
      };

      // Filter by carrier if provided
      if (carrierId) {
        where.carrier_id = carrierId;
      }

      // Get procedure requirements from view
      const requirements = await prisma.procedureRequirementsView.findMany({
        where
      });

      if (!requirements.length) {
        throw new Error('No requirements found for procedure');
      }

      return requirements;
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        console.error('Prisma validation error:', error.message);
        throw new Error('Invalid procedure code or carrier ID provided');
      } else {
        // Re-throw the error if it's already a custom error
        if (error instanceof Error && error.message === 'No requirements found for procedure') {
          throw error;
        }
        console.error('Error getting procedure requirements:', error);
        throw error;
      }
    }
  }
}
