import { UploadApiResponse } from 'cloudinary';
import { cloudinary, CLOUDINARY_FOLDER } from '../config/cloudinary';

export interface StoredImage {
  url: string;
  publicId: string;
}

/**
 * Storage abstraction over Cloudinary (D-4). Controllers/services depend on
 * this interface, not on Cloudinary directly, so the provider can be swapped.
 */
export const storageService = {
  /** Upload an in-memory image buffer and return its secure URL + public_id. */
  uploadImage(buffer: Buffer): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: CLOUDINARY_FOLDER, resource_type: 'image' },
        (err, result?: UploadApiResponse) => {
          if (err || !result) return reject(err ?? new Error('Upload failed'));
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  },

  /** Best-effort delete of assets from Cloudinary (ignores unknown ids). */
  async deleteImages(publicIds: string[]): Promise<void> {
    const ids = publicIds.filter(Boolean);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        cloudinary.uploader.destroy(id).catch(() => {
          /* ignore individual failures — DB rows are the source of truth */
        }),
      ),
    );
  },
};
