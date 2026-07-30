import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import apiRoutes from './routes';

/** Builds and configures the Express application (kept separate from the
 *  server bootstrap so it can be imported by tests later). */
export function createApp(): Application {
  const app = express();

  // Behind a reverse proxy (Vercel/Render) in production: trust the first proxy
  // hop so req.ip reflects the real client (correct rate-limiting) and Secure
  // cookies work. Left off in dev (direct connections).
  if (env.isProd) app.set('trust proxy', 1);

  // Security + parsing baseline (D-13).
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API routes (mounted at root; individual routers own their prefixes).
  app.use('/', apiRoutes);

  // Swagger UI (D-13).
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

  // 404 + centralized error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
