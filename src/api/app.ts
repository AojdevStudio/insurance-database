import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { handlePrismaErrors } from './middleware/prisma-error.js';
import { validateApiKey } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { monitor } from './middleware/monitoring.js';
import { ApiKeyService } from '../services/apiKey.service.js';
import { RateLimitService } from '../services/rateLimit.service.js';
import { AuditLogService } from '../services/auditLog.service.js';
import carrierRoutes from './routes/carrier.routes.js';
import procedureRoutes from './routes/procedure.routes.js';
import guidelinesRoutes from './routes/guidelines.routes.js';
import fuzzySearchRoutes from './routes/fuzzy-search.routes.js';
import prismaCarrierRoutes from './routes/prisma/carrier.routes.js';
import prismaProcedureRoutes from './routes/prisma/procedure.routes.js';
import prismaGuidelinesRoutes from './routes/prisma/guidelines.routes.js';
import { supabase } from '../utils/supabase.js';
import { testConnection } from '../lib/prisma.js';

const app = express();

// Initialize services
const apiKeyService = new ApiKeyService(supabase);
const rateLimitService = new RateLimitService(supabase);
const auditLogService = new AuditLogService(supabase);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.SUPABASE_URL || ''],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-ID', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API security middleware
app.use(validateApiKey(apiKeyService));
app.use(rateLimit(rateLimitService));
app.use(monitor(auditLogService));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/carriers', carrierRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/guidelines', guidelinesRoutes);
app.use('/api/fuzzy-search', fuzzySearchRoutes);

// Prisma API routes (for testing and comparison)
app.use('/api/prisma/carriers', prismaCarrierRoutes);
app.use('/api/prisma/procedures', prismaProcedureRoutes);
app.use('/api/prisma/guidelines', prismaGuidelinesRoutes);

// Test Prisma connection on startup
testConnection().then(connected => {
  if (connected) {
    console.log('✅ Prisma database connection successfully established');
  } else {
    console.error('❌ Prisma database connection failed');
  }
});

// Error handling
app.use(notFoundHandler);
app.use(handlePrismaErrors);
app.use(errorHandler);

export default app;