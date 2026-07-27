import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Streams an in-memory buffer straight to Cloudinary — nothing
 * touches disk. Rejects with Cloudinary's raw error; callers should
 * wrap this in their own error handling (see attachProductPhotos).
 */
export const uploadBufferToCloudinary = (
  buffer: Buffer,
  options: { folder?: string } = {},
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? 'products',
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed with no result'));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

export default cloudinary;
