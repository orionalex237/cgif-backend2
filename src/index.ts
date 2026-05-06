// src/index.ts - CGIF Backend

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

import authRoutes     from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import kycRoutes      from './routes/kyc.js';
import aiRoutes       from './routes/ai.js';

import {
  usersRouter, clustersRouter, postsRouter, documentsRouter,
  investmentsRouter, messagesRouter, notificationsRouter, pollsRouter,
  announcementsRouter, eventsRouter, newsRouter, parrainageRouter,
  analyticsRouter, auditRouter, ndaRouter,
} from './routes/all-routes.js';

import { prismaErrorHandler, globalErrorHandler } from './utils/prismaErrorHandler.js';
import { getRedis, disconnectRedis } from './services/redis.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

const app  = express();
const PORT = process.env.PORT || 3001;
const BASE = '/api/v1';

app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requetes. Reessayez dans 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives.' },
  skipSuccessfulRequests: true,
});

app.use('/api', limiter);

app.use(`${BASE}/auth`,          authLimiter, authRoutes);
app.use(`${BASE}/users`,         usersRouter);
app.use(`${BASE}/clusters`,      clustersRouter);
app.use(`${BASE}/projects`,      projectsRoutes);
app.use(`${BASE}/posts`,         postsRouter);
app.use(`${BASE}/documents`,     documentsRouter);
app.use(`${BASE}/investments`,   investmentsRouter);
app.use(`${BASE}/kyc`,           kycRoutes);
app.use(`${BASE}/messages`,      messagesRouter);
app.use(`${BASE}/notifications`, notificationsRouter);
app.use(`${BASE}/polls`,         pollsRouter);
app.use(`${BASE}/announcements`, announcementsRouter);
app.use(`${BASE}/events`,        eventsRouter);
app.use(`${BASE}/news`,          newsRouter);
app.use(`${BASE}/parrainage`,    parrainageRouter);
app.use(`${BASE}/analytics`,     analyticsRouter);
app.use(`${BASE}/audit`,         auditRouter);
app.use(`${BASE}/nda`,           ndaRouter);
app.use(`${BASE}/ai`,            aiRoutes);

app.get('/health', async (_req, res) => {
  let dbOk = true;
  let redisOk = false;
  try { await prisma.$queryRaw`SELECT 1`; } catch { dbOk = false; }
  try {
    const redis = await getRedis();
    if (redis) { await redis.ping(); redisOk = true; }
  } catch { /* Redis optionnel */ }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: { db: dbOk ? 'ok' : 'error', redis: redisOk ? 'ok' : 'unavailable' },
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

app.use(prismaErrorHandler);
app.use(globalErrorHandler);

async function main() {
  await prisma.$connect();
  console.log('PostgreSQL connecte');
  await getRedis();
  app.listen(PORT, () => {
    console.log('CGIF API - http://localhost:' + PORT);
    console.log('Env : ' + (process.env.NODE_ENV || 'development'));
  });
}

main().catch((err) => {
  console.error('Erreur au demarrage :', err);
  process.exit(1);
});

async function shutdown() {
  await prisma.$disconnect();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
