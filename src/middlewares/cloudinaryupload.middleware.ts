import { Request, Response, NextFunction } from 'express';
import { uploadBufferToCloudinary } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

/**
 * Runs after `productPhotosUpload` (Multer) and BEFORE the zod
 * `validate` middleware.
 *
 * Reads the in-memory files Multer attached to req.files, uploads
 * each buffer to Cloudinary, and rewrites req.body.photos into the
 * exact shape createProductSchema / updateProductSchema / the
 * service layer already expect: { url, sortOrder }[].
 *
 * If no files were sent (e.g. an update that doesn't touch photos),
 * this is a no-op — req.body.photos is left untouched so the rest
 * of the update can still go through.
 */
const attachProductPhotos = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (typeof req.body.variants === 'string') {
    try {
      req.body.variants = JSON.parse(req.body.variants);
    } catch {
      next(new ApiError(HTTP_STATUS.BAD_REQUEST, 'variants must be valid JSON'));
      return;
    }
  }
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (files.length === 0) {
    next();
    return;
  }

  try {
    const uploaded = await Promise.all(
      files.map((file) => uploadBufferToCloudinary(file.buffer, { folder: 'products' })),
    );

    req.body.photos = uploaded.map((result, index) => ({
      url: result.secure_url,
      sortOrder: index,
    }));

    next();
  } catch (error) {
    // Never leak Cloudinary's internal error details to the client.
    next(new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'Failed to upload product photos'));
  }
};

export default attachProductPhotos;
