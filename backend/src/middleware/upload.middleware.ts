import multer from 'multer';
import { HttpError } from './error.middleware';

/**
 * Multipart image upload handling (Session 4). Files are kept in memory and
 * streamed straight to Cloudinary — nothing touches local disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Only image files are allowed', 'INVALID_FILE_TYPE'));
    }
  },
});

/** Accept up to 10 files under the `images` form field. */
export const uploadImages = upload.array('images', 10);
