import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Folder that namespaces this project's assets on the shared account (D-4). */
export const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER ?? 'real-estate';

export { cloudinary };
