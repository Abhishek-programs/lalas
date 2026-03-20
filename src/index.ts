import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import swaggerUi from 'swagger-ui-express';

import { ENV } from './config/env';
import { container } from './container';
import { PrismaService } from './infrastructure/database/prisma';
import { WebSocketService } from './interfaces/ws/WebSocketService';
import { startWorker } from './infrastructure/queue/PromptWorker';
import { startCronScheduler } from './infrastructure/cron/scheduler';

import authRoutes from './interfaces/http/routes/authRoutes';
import subscriptionRoutes from './interfaces/http/routes/subscriptionRoutes';
import userRoutes from './interfaces/http/routes/userRoutes';
import audioRoutes from './interfaces/http/routes/audioRoutes';
import promptRoutes from './interfaces/http/routes/promptRoutes';
import searchRoutes from './interfaces/http/routes/searchRoutes';
import { swaggerSpec } from './config/swagger';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/auth', authRoutes);
app.use('/subscription', subscriptionRoutes);
app.use('/users', userRoutes);
app.use('/audio', audioRoutes);
app.use('/prompts', promptRoutes);
app.use('/search', searchRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
  const prisma = container.resolve(PrismaService);

  try {
    await prisma.connect();
    console.log('✅ Database connected');
  } catch (e) {
    console.error('❌ Failed to connect to database', e);
  }

  const server = http.createServer(app);

  // Initialize WebSocket server
  const wsService = container.resolve(WebSocketService);
  wsService.init(server);

  // Start background worker
  startWorker();

  // Start cron scheduler
  startCronScheduler();

  server.listen(ENV.PORT, () => {
    console.log(`🚀 Server listening on port ${ENV.PORT}`);
    console.log(`📚 Swagger docs: http://localhost:${ENV.PORT}/api/docs`);
    console.log(`🔌 WebSocket: ws://localhost:${ENV.PORT}/ws`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
