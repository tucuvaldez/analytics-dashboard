import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './errors/AppError.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboards.routes.js';
import reportRoutes from './routes/reports.routes.js';

export const app = express();

app.disable('x-powered-by');
// Needed for correct client IPs (rate limiting) behind a reverse proxy / load balancer.
if (env.isProduction) app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (curl, Postman, server-to-server) which send no Origin.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new AppError(403, 'CORS_ERROR', 'Origin not allowed by CORS policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: '1mb' }));

// Health check is registered before the rate limiter so orchestrators can poll freely.
app.get('/health', (_req, res) => {
  res.json({ status: 'Backend OK' });
});

app.use(globalLimiter);

app.use('/auth', authRoutes);
app.use('/dashboards', dashboardRoutes);
app.use('/reports', reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
