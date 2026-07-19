import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';

// Utilities & Configs
import { env } from './config/env.js';
import logger from './utils/logger.js';
import ApiError from './utils/ApiError.js';
import { SuccessResponse } from './utils/ApiResponse.js'; // 🟢 For health check alignment
import { HTTP_STATUS } from './constants/index.js';

// Middlewares & Routes
import { defaultLimiter } from './middlewares/rateLimiter.middleware.js';
import errorMiddleware from './middlewares/error.middleware.js';
import router from './routes/index.js';

const app = express();

// 🟢 2. Generate and bind Correlation Request IDs
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 🟢 3. Link Express Request IDs directly to Pino logs
app.use(
  (pinoHttp as any)({
    logger,
    genReqId: (req: IncomingMessage) => (req as any).id || randomUUID(),
  }),
);

// 🛡️ Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? ['https://yourdomain.com', 'https://app.yourdomain.com']
        : '*',
    credentials: true,
  }),
);
app.use(defaultLimiter);

// 📦 Body Parsing Configurations
app.use('/api/v1/payments/chapa/webhook', express.raw({ type: '*/*', limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 🚀 Core Application Routing Paths
app.use('/api/v1', router);

// 🟢 4. Realignment of Health Check Endpoint to your Design System Shell
app.get('/health', (req, res) => {
  return res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Server is running healthily', { status: 'ok' }));
});

// 🔍 404 Route Catch-All Handling
app.use((req, res, next) => {
  next(new ApiError(HTTP_STATUS.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
});

// 🛡️ Global Unified Error Interceptor Pipeline
app.use(errorMiddleware);

export default app;
