/**
 * Prisma-based implementation of the CarrierService
 * Handles CRUD operations for insurance carriers
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { ICarrier, ICarrierSearchQuery } from '../../types/carrier.js';

export class PrismaCarrierService {
  /**
   * List carriers with pagination and sorting
   * @param options Query parameters for pagination and sorting
   * @returns Paginated list of carriers with metadata
   */
  static async listCarriers(options: ICarrierSearchQuery = {}) {
    const {
      page = 1,
      limit = 10,
      sort_by = 'name',
      sort_order = 'asc'
    } = options;

    // Ensure numeric types
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Get total count of carriers
      const total = await prisma.insuranceCarrier.count();

      // Validate sort_by field (to prevent injection)
      const validSortFields = ['id', 'name', 'created_at'];
      const sortField = validSortFields.includes(String(sort_by)) 
        ? String(sort_by) 
        : 'name';

      // Get paginated carriers
      const carriers = await prisma.insuranceCarrier.findMany({
        skip: offset,
        take: limitNum,
        orderBy: {
          [sortField]: sort_order === 'asc' ? 'asc' : 'desc'
        }
      });

      // Map Prisma model to application interface
      const mappedCarriers: ICarrier[] = carriers.map(carrier => ({
        id: carrier.id as number,
        name: carrier.name,
        code: null, // Update based on your schema
        contact_info: null, // Update based on your schema
        website: null, // Update based on your schema
        created_at: carrier.created_at || new Date()
      }));

      return {
        carriers: mappedCarriers,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Known request error (e.g., unique constraint violation)
        console.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        // Validation error (e.g., required field missing)
        console.error('Prisma validation error:', error.message);
        throw new Error('Invalid data provided');
      } else {
        // Unknown error
        console.error('Error listing carriers:', error);
        throw error;
      }
    }
  }

  /**
   * Search carriers by name with pagination and sorting
   * @param options Search query, pagination and sorting parameters
   * @returns Paginated search results with metadata
   */
  static async searchCarriers(options: ICarrierSearchQuery = {}) {
    const {
      query = '',
      page = 1,
      limit = 10,
      sort_by = 'name',
      sort_order = 'asc'
    } = options;

    // Ensure numeric types
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Define search criteria
      const searchWhere = {
        name: {
          contains: query,
          mode: 'insensitive' as const
        }
      };

      // Get total count for search results
      const total = await prisma.insuranceCarrier.count({
        where: searchWhere
      });

      // Validate sort_by field (to prevent injection)
      const validSortFields = ['id', 'name', 'created_at'];
      const sortField = validSortFields.includes(String(sort_by)) 
        ? String(sort_by) 
        : 'name';

      // Get paginated search results
      const carriers = await prisma.insuranceCarrier.findMany({
        where: searchWhere,
        skip: offset,
        take: limitNum,
        orderBy: {
          [sortField]: sort_order === 'asc' ? 'asc' : 'desc'
        }
      });

      // Map Prisma model to application interface
      const mappedCarriers: ICarrier[] = carriers.map(carrier => ({
        id: carrier.id as number,
        name: carrier.name,
        code: null, // Update based on your schema
        contact_info: null, // Update based on your schema
        website: null, // Update based on your schema
        created_at: carrier.created_at || new Date()
      }));

      return {
        carriers: mappedCarriers,
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
        console.error('Error searching carriers:', error);
        throw error;
      }
    }
  }

  /**
   * Get a single carrier by ID
   * @param id Carrier ID
   * @returns Carrier data or throws if not found
   */
  static async getCarrierById(id: number): Promise<ICarrier> {
    try {
      const carrier = await prisma.insuranceCarrier.findUnique({
        where: { id: id }
      });

      if (!carrier) {
        throw new Error('Carrier not found');
      }

      // Map Prisma model to application interface
      return {
        id: carrier.id as number,
        name: carrier.name,
        code: null, // Update based on your schema
        contact_info: null, // Update based on your schema
        website: null, // Update based on your schema
        created_at: carrier.created_at || new Date()
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // P2025 is "Record not found"
          throw new Error('Carrier not found');
        }
        console.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        console.error('Prisma validation error:', error.message);
        throw new Error('Invalid carrier ID provided');
      } else {
        // Re-throw the error if it's already a custom error (like "Carrier not found")
        if (error instanceof Error && error.message === 'Carrier not found') {
          throw error;
        }
        console.error('Error getting carrier by ID:', error);
        throw error;
      }
    }
  }
}
