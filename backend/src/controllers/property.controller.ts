import { Request, Response } from 'express';
import { HttpError } from '../middleware/error.middleware';
import { propertyService } from '../services/property.service';
import { storageService } from '../services/storage.service';

/**
 * @openapi
 * components:
 *   schemas:
 *     PropertyImage:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         url: { type: string }
 *         position: { type: integer }
 *     Property:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         ownerId: { type: string, format: uuid }
 *         title: { type: string }
 *         description: { type: string }
 *         price: { type: integer }
 *         city: { type: string }
 *         propertyType:
 *           type: string
 *           enum: [apartment, house, condo, townhouse, land, commercial]
 *         bedrooms: { type: integer }
 *         bathrooms: { type: integer }
 *         createdAt: { type: string, format: date-time }
 *         images:
 *           type: array
 *           items: { $ref: '#/components/schemas/PropertyImage' }
 *     PropertyInput:
 *       type: object
 *       required: [title, description, price, city, propertyType, bedrooms, bathrooms]
 *       properties:
 *         title: { type: string, example: Sunny 2-bed condo }
 *         description: { type: string, example: Bright corner unit near downtown. }
 *         price: { type: integer, example: 425000 }
 *         city: { type: string, example: Austin }
 *         propertyType: { type: string, example: condo }
 *         bedrooms: { type: integer, example: 2 }
 *         bathrooms: { type: integer, example: 2 }
 *         imageUrls:
 *           type: array
 *           items: { type: string, format: uri }
 */

/**
 * @openapi
 * /api/properties:
 *   get:
 *     summary: List properties (newest first, cursor-paginated)
 *     tags: [Properties]
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: nextCursor from the previous page
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: A page of properties + nextCursor (null when no more).
 */
export async function listProperties(req: Request, res: Response): Promise<void> {
  const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
  const result = await propertyService.list(cursor, limit);
  res.status(200).json(result);
}

/**
 * @openapi
 * /api/properties/mine:
 *   get:
 *     summary: List the authenticated user's own properties (cursor-paginated)
 *     tags: [Properties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: cursor, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: The user's listings + nextCursor }
 *       401: { description: Not authenticated }
 */
export async function listMyProperties(req: Request, res: Response): Promise<void> {
  const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
  const result = await propertyService.list(cursor, limit, req.user!.id);
  res.status(200).json(result);
}

/**
 * @openapi
 * /api/properties/search:
 *   get:
 *     summary: Search + filter properties (keyset-paginated, sortable)
 *     tags: [Properties]
 *     parameters:
 *       - { in: query, name: city, schema: { type: string }, example: Austin }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [apartment, house, condo, townhouse, land, commercial] }
 *       - { in: query, name: minBudget, schema: { type: integer } }
 *       - { in: query, name: maxBudget, schema: { type: integer } }
 *       - { in: query, name: bedrooms, schema: { type: integer }, description: 'Minimum bedrooms (N+)' }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, price_asc, price_desc], default: newest }
 *       - { in: query, name: cursor, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: A page of matching properties + nextCursor.
 */
export async function searchProperties(req: Request, res: Response): Promise<void> {
  const result = await propertyService.search(req.query as unknown as Parameters<typeof propertyService.search>[0]);
  res.status(200).json(result);
}

/**
 * @openapi
 * /api/properties/{id}:
 *   get:
 *     summary: Get a property by id (with images)
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: The property }
 *       404: { description: Not found }
 */
export async function getProperty(req: Request, res: Response): Promise<void> {
  const property = await propertyService.getById(req.params.id);
  res.status(200).json(property);
}

/**
 * @openapi
 * /api/properties/{id}/similar:
 *   get:
 *     summary: Get up to 6 similar properties
 *     description: Same city + type, price within ±20%, ranked by price closeness. Cached ~60s.
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Array of similar properties (may be fewer than 6).
 *       404: { description: Property not found }
 */
export async function getSimilarProperties(req: Request, res: Response): Promise<void> {
  const result = await propertyService.getSimilar(req.params.id);
  res.status(200).json(result);
}

/**
 * @openapi
 * /api/properties:
 *   post:
 *     summary: Create a property listing
 *     tags: [Properties]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PropertyInput' }
 *     responses:
 *       201: { description: Created }
 *       401: { description: Not authenticated }
 */
export async function createProperty(req: Request, res: Response): Promise<void> {
  const property = await propertyService.create(req.user!.id, req.body);
  res.status(201).json(property);
}

/**
 * @openapi
 * /api/properties/{id}:
 *   put:
 *     summary: Update a property (owner only)
 *     tags: [Properties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PropertyInput' }
 *     responses:
 *       200: { description: Updated }
 *       403: { description: Not the owner }
 *       404: { description: Not found }
 */
export async function updateProperty(req: Request, res: Response): Promise<void> {
  const property = await propertyService.update(req.params.id, req.body);
  res.status(200).json(property);
}

/**
 * @openapi
 * /api/properties/{id}:
 *   delete:
 *     summary: Delete a property (owner only)
 *     tags: [Properties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       403: { description: Not the owner }
 *       404: { description: Not found }
 */
export async function deleteProperty(req: Request, res: Response): Promise<void> {
  await propertyService.remove(req.params.id);
  res.status(204).send();
}

/**
 * @openapi
 * /api/properties/{id}/images:
 *   post:
 *     summary: Upload images for a property (owner only)
 *     tags: [Properties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Images uploaded and attached }
 *       400: { description: No files / invalid file type }
 *       403: { description: Not the owner }
 */
export async function uploadPropertyImages(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new HttpError(400, 'No image files provided', 'NO_FILES');
  }
  const stored = await Promise.all(files.map((f) => storageService.uploadImage(f.buffer)));
  const images = await propertyService.addImages(req.params.id, stored);
  res.status(201).json({ images });
}

/**
 * @openapi
 * /api/properties/{id}/images/{imageId}:
 *   delete:
 *     summary: Delete one image from a property (owner only)
 *     tags: [Properties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Image not found }
 */
export async function deletePropertyImage(req: Request, res: Response): Promise<void> {
  await propertyService.removeImage(req.params.id, req.params.imageId);
  res.status(204).send();
}
