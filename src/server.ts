import { createDatabase } from './db/database';
import { createApp } from './app';
import { CoinsRepository } from './coins/coins.repository';
import { PricesRepository } from './prices/prices.repository';
import { BinanceClient } from './binance/binance.client';
import { PriceSyncJob } from './jobs/price-sync.job';

const port = Number(
  process.env.PORT ?? 3000
);

const dbPath =
  process.env.DB_PATH ?? './data/app.sqlite';

const syncIntervalMs = Number(
  process.env.PRICE_SYNC_INTERVAL_MS ?? 60000
);

const db = createDatabase(dbPath);

const coinsRepository = new CoinsRepository(db);
const pricesRepository = new PricesRepository(db);
const binanceClient = new BinanceClient();

const priceSyncJob = new PriceSyncJob(
  coinsRepository,
  pricesRepository,
  binanceClient,
  syncIntervalMs
);

const app = createApp(db);

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);

  priceSyncJob.start();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(`${signal} received. Shutting down...`);

  const serverClosed = new Promise<void>(
    (resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }
  );

  try {
    await Promise.all([
      priceSyncJob.stop(),
      serverClosed
    ]);

    db.close();

    console.log('Shutdown completed');
  } catch (error) {
    console.error('Shutdown failed:', error);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});