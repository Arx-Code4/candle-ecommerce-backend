import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { toPriceString } from '../utils/price.js';

type ProductVariant = {
  id: string;
  scent: string;
  size: string;
  stock: number;
};

type ProductSummary = {
  id: string;
  name: string;
  price: string; // ADD — toPriceString(product.price), same helper cart.service.ts already uses
  primaryPhotoUrl: string | null; // ADD
  variants: ProductVariant[];
};

type ProductDetail = ProductSummary & {
  photos: string[];
  description: string;
};

export async function getPublishedProducts(filters: {
  scent?: string;
  size?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: ProductSummary[]; page: number; limit: number; total: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const variantConditions: Prisma.ProductVariantWhereInput[] = [];
  if (filters.scent) variantConditions.push({ scent: filters.scent });
  if (filters.size) variantConditions.push({ size: filters.size });

  const where: Prisma.ProductWhereInput = {
    isPublished: true,
    ...(variantConditions.length > 0 && {
      variants: { some: { AND: variantConditions } },
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { variants: true, photos: true }, // was: { variants: true }
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const items: ProductSummary[] = rows.map((product) => ({
    id: product.id,
    name: product.name,
    price: toPriceString(Number(product.price)), // ADD — import toPriceString from '../utils/price.js' (already used in cart.service.ts)
    primaryPhotoUrl:
      [...(product.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      scent: variant.scent,
      size: variant.size,
      stock: variant.stock,
    })),
  }));

  return { items, page, limit, total };
}

export async function getPublishedProductById(id: string): Promise<ProductDetail> {
  const product = await prisma.product.findFirst({
    where: { id, isPublished: true },
    include: { photos: true, variants: true },
  });

  if (!product || !product.isPublished) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
  }

  return {
    id: product.id,
    name: product.name,
    price: toPriceString(Number(product.price)),
    primaryPhotoUrl:
      [...(product.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      scent: variant.scent,
      size: variant.size,
      stock: variant.stock,
    })),
    photos: [...product.photos].sort((a, b) => a.sortOrder - b.sortOrder).map((photo) => photo.url),
    description: product.description,
  };
}
