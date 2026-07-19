import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

export interface ProductPhotoDetail {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductVariantDetail {
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
  photos: ProductPhotoDetail[];
  variants: ProductVariantDetail[];
}

export interface CreateProductPhotoInput {
  url: string;
  sortOrder?: number;
}

export interface CreateProductVariantInput {
  scent: string;
  size: string;
  stock: number;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  photos: CreateProductPhotoInput[];
  variants: CreateProductVariantInput[];
}

export interface UpdateProductVariantInput extends CreateProductVariantInput {
  id?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  photos?: CreateProductPhotoInput[];
  variants?: UpdateProductVariantInput[];
}

export interface ListAllProductsQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { photos: true; variants: true };
}>;

// Normalized for comparison — trim + lowercase. The original casing/whitespace is preserved on write.
const normalizeVariantKey = (scent: string, size: string): string =>
  `${scent.trim().toLowerCase()}::${size.trim().toLowerCase()}`;

const assertNoDuplicateVariants = (variants: Array<{ scent: string; size: string }>): void => {
  const seen = new Set<string>();
  for (const variant of variants) {
    const key = normalizeVariantKey(variant.scent, variant.size);
    if (seen.has(key)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Duplicate scent/size combination');
    }
    seen.add(key);
  }
};

const isRecordNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'P2025';

// ---------- FIX: handle missing relations safely ----------
const toProductDetail = (product: ProductWithRelations): ProductDetail => {
  const photos = product.photos ?? [];
  const variants = product.variants ?? [];
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    isPublished: product.isPublished,
    photos: [...photos]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((photo) => ({ id: photo.id, url: photo.url, sortOrder: photo.sortOrder })),
    variants: variants.map((variant) => ({
      id: variant.id,
      scent: variant.scent,
      size: variant.size,
      stock: variant.stock,
    })),
  };
};

export const createProduct = async (input: CreateProductInput): Promise<ProductDetail> => {
  assertNoDuplicateVariants(input.variants);

  const created = await prisma.product.create({
    data: {
      name: input.name,
      description: input.description,
      price: input.price,
      photos: {
        create: input.photos.map((photo, index) => ({
          url: photo.url,
          sortOrder: photo.sortOrder ?? index,
        })),
      },
      variants: {
        create: input.variants.map((variant) => ({
          scent: variant.scent,
          size: variant.size,
          stock: variant.stock,
        })),
      },
    },
    include: { photos: true, variants: true },
  });

  return toProductDetail(created);
};

export const getAllProducts = async (
  query: ListAllProductsQuery,
): Promise<PaginatedResult<ProductDetail>> => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      include: { photos: true, variants: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count(),
  ]);

  return { items: rows.map(toProductDetail), page, limit, total };
};

export const updateProduct = async (
  id: string,
  input: UpdateProductInput,
): Promise<ProductDetail> => {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: { photos: true, variants: true },
  });

  if (!existing) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
  }

  // ---------- FIX: guard against undefined variants ----------
  if (input.variants) {
    assertNoDuplicateVariants(input.variants);

    const incomingIds = new Set(input.variants.filter((v) => v.id).map((v) => v.id as string));
    const removedVariants = (existing.variants ?? []).filter((v) => !incomingIds.has(v.id));

    if (removedVariants.length > 0) {
      const orderItemCount = await prisma.orderItem.count({
        where: { productVariantId: { in: removedVariants.map((v) => v.id) } },
      });

      if (orderItemCount > 0) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Cannot remove a variant with existing orders');
      }
    }
  }

  const data: Prisma.ProductUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;

  if (input.photos) {
    data.photos = {
      deleteMany: {},
      create: input.photos.map((photo, index) => ({
        url: photo.url,
        sortOrder: photo.sortOrder ?? index,
      })),
    };
  }

  if (input.variants) {
    const toUpdate = input.variants.filter(
      (variant): variant is UpdateProductVariantInput & { id: string } => Boolean(variant.id),
    );
    const toCreate = input.variants.filter((variant) => !variant.id);
    const keepIds = toUpdate.map((variant) => variant.id);

    data.variants = {
      deleteMany: { id: { notIn: keepIds } },
      update: toUpdate.map((variant) => ({
        where: { id: variant.id },
        data: { scent: variant.scent, size: variant.size, stock: variant.stock },
      })),
      create: toCreate.map((variant) => ({
        scent: variant.scent,
        size: variant.size,
        stock: variant.stock,
      })),
    };
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
    include: { photos: true, variants: true },
  });

  return toProductDetail(updated);
};

// ---------- FIX: always return only the required fields ----------
export const setProductPublishStatus = async (
  id: string,
  isPublished: boolean,
): Promise<{ id: string; isPublished: boolean }> => {
  try {
    const result = await prisma.product.update({
      where: { id },
      data: { isPublished },
      select: { id: true, isPublished: true },
    });
    // Even if Prisma returns extra fields (e.g., due to mock), we explicitly return only what's needed.
    return { id: result.id, isPublished: result.isPublished };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
    }
    throw error;
  }
};
