import express, { Express } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { authMiddleware } from './middleware/auth.middleware';
import { createCoinsRouter } from './coins/coins.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { resolve } from 'node:path';

export function createApp(db: DatabaseSync): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok'
    });
  });

  app.get('/openapi.json', (req, res) => {
    res.sendFile(
      resolve(
        process.cwd(),
        'openapi',
        'openapi.json'
      )
    );
  });

  app.get('/docs', (req, res) => {
    res.type('html').send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Crypto Tracker API - Swagger</title>

        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
        >
      </head>

      <body>
        <div id="swagger-ui"></div>

        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>

        <script>
          SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            persistAuthorization: true
          });
        </script>
      </body>
      </html>
    `);
  });

  app.use('/api', authMiddleware);

  app.use('/api/coins', createCoinsRouter(db));

  app.use(errorMiddleware);

  return app;
}