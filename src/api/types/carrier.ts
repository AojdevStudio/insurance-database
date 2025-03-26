import { Request } from 'express';

export interface ICarrier {
  id: number;
  name: string;
  code: string | null;
  contact_info: {
    phone?: string;
    email?: string;
    address?: string;
  } | null;
  website: string | null;
  created_at: string | Date;
}

export interface ICarrierResponse extends Omit<ICarrier, 'created_at'> {
  created_at: string;
}

export interface ICarrierSearchQuery {
  page?: string | number;
  limit?: string | number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  query?: string;
}

export interface ICarrierListResponse {
  carriers: ICarrier[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ICarrierListResponseJSON extends Omit<ICarrierListResponse, 'carriers'> {
  carriers: ICarrierResponse[];
}

// Express request with typed query parameters
export interface ICarrierSearchRequest extends Request {
  query: ICarrierSearchQuery;
}

// Express request with typed params
export interface ICarrierDetailRequest extends Request {
  params: {
    id: string;
  };
} 