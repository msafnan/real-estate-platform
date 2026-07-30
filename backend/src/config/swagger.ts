import swaggerJSDoc from 'swagger-jsdoc';

/**
 * Swagger/OpenAPI scaffold (D-13). Endpoint docs are added inline via JSDoc
 * `@openapi` comments in the route files; this config discovers them.
 * Mounted at /api-docs in app.ts.
 */
const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Real-Estate Listing Platform API',
      version: '0.1.0',
      description:
        'JSON API for the real-estate listing platform. See DECISIONS.md for architecture rationale.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // Scan route + controller files for @openapi JSDoc blocks.
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
