import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

export function createDatabase(dbPath: string): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      pair TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin_id INTEGER NOT NULL,
      price TEXT NOT NULL,
      recorded_at INTEGER NOT NULL,

      FOREIGN KEY (coin_id)
        REFERENCES coins(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_coin_time
    ON price_history(coin_id, recorded_at);
      `);

  return db;
}