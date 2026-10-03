import express, { Express } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { authMiddleware } from './middleware/auth.middleware';
import { createCoinsRouter } from './coins/coins.routes';

export function createApp(db: DatabaseSync): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok'
    });
  });

  app.use('/api', authMiddleware);

  app.use('/api/coins', createCoinsRouter(db));

  return app;
}