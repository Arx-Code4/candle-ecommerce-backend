import { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 6;

// memoryStorage — untrusted uploads never touch disk. We hand the
// buffer straight to Cloudinary and let it go out of scope.
const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new ApiError(HTTP_STATUS.BAD_REQUEST, `Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
  },
}).array('photos', MAX_FILES);

/**
 * Wraps multer's array() middleware so every failure mode — bad
 * mimetype, oversized file, too many files, malformed multipart body —
 * surfaces as a single, consistent ApiError(400) instead of a raw
 * MulterError or a generic 500. Mount this before `validate`.
 */
const productPhotosUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof MulterError) {
      next(new ApiError(HTTP_STATUS.BAD_REQUEST, err.message));
      return;
    }

    if (err instanceof ApiError) {
      next(err);
      return;
    }

    next(new ApiError(HTTP_STATUS.BAD_REQUEST, 'File upload failed'));
  });
};

export default productPhotosUpload;
