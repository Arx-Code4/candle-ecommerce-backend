import { CreateProductInput, UpdateProductInput } from '../schemas/admin-product.schema.js';

export interface ProductPhoto {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  scent: string;
  size: string;
  stock: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  description: string;
  price: number;
  isPublished: boolean;
  photos: ProductPhoto[];
  variants: ProductVariant[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ListProductsQuery {
  page?: number;
  limit?: number;
}

export const createProduct = async (data: CreateProductInput['body']): Promise<ProductDetail> => {
  throw new Error('Not implemented');
};

export const getAllProducts = async (
  query: ListProductsQuery,
): Promise<PaginatedResult<ProductDetail>> => {
  throw new Error('Not implemented');
};

export const updateProduct = async (
  id: string,
  data: UpdateProductInput['body'],
): Promise<ProductDetail> => {
  throw new Error('Not implemented');
};

export const setProductPublishStatus = async (
  id: string,
  isPublished: boolean,
): Promise<{ id: string; isPublished: boolean }> => {
  throw new Error('Not implemented');
};
