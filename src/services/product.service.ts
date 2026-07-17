type ProductVariant = {
  id: string;
  scent: string;
  size: string;
  stock: number;
};

type ProductSummary = {
  id: string;
  name: string;
  variants: ProductVariant[];
};

type ProductDetail = ProductSummary & {
  photos: string[];
};

export async function getPublishedProducts(filters: {
  scent?: string;
  size?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: ProductSummary[]; page: number; limit: number; total: number }> {
  throw new Error('Not implemented');
}

export async function getPublishedProductById(id: string): Promise<ProductDetail> {
  throw new Error('Not implemented');
}
