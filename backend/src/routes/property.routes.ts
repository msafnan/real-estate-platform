import { Router } from 'express';
import {
  createProperty,
  deleteProperty,
  deletePropertyImage,
  getProperty,
  getSimilarProperties,
  listMyProperties,
  listProperties,
  searchProperties,
  updateProperty,
  uploadPropertyImages,
} from '../controllers/property.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { isOwner } from '../middleware/isOwner.middleware';
import { uploadImages } from '../middleware/upload.middleware';
import inquiryRoutes from './inquiry.routes';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createPropertySchema,
  idParamSchema,
  listPropertiesSchema,
  searchPropertiesSchema,
  updatePropertySchema,
} from '../validators/property.validators';

const router = Router();

// Public reads. NOTE: /search must be declared before /:id so it isn't
// captured by the :id param.
router.get('/search', validate(searchPropertiesSchema), asyncHandler(searchProperties));
router.get(
  '/mine',
  authMiddleware,
  validate(listPropertiesSchema),
  asyncHandler(listMyProperties),
);
router.get('/', validate(listPropertiesSchema), asyncHandler(listProperties));
router.get('/:id/similar', validate(idParamSchema), asyncHandler(getSimilarProperties));
router.get('/:id', validate(idParamSchema), asyncHandler(getProperty));

// Authenticated write.
router.post('/', authMiddleware, validate(createPropertySchema), asyncHandler(createProperty));

// Owner-only writes (authMiddleware → isOwner runs the ownership check).
router.put(
  '/:id',
  authMiddleware,
  validate(idParamSchema),
  asyncHandler(isOwner),
  validate(updatePropertySchema),
  asyncHandler(updateProperty),
);
router.delete(
  '/:id',
  authMiddleware,
  validate(idParamSchema),
  asyncHandler(isOwner),
  asyncHandler(deleteProperty),
);

// Owner-only image management.
router.post(
  '/:id/images',
  authMiddleware,
  validate(idParamSchema),
  asyncHandler(isOwner),
  uploadImages,
  asyncHandler(uploadPropertyImages),
);
router.delete(
  '/:id/images/:imageId',
  authMiddleware,
  validate(idParamSchema),
  asyncHandler(isOwner),
  asyncHandler(deletePropertyImage),
);

// Nested inquiries: /api/properties/:id/inquiries
router.use('/:id/inquiries', inquiryRoutes);

export default router;
