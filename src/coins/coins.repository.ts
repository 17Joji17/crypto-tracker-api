import { DatabaseSync } from 'node:sqlite';

export interface Coin {
  id: number;
  symbol: string;
  pair: string;
  created_at: string;
}

export class CoinsRepository {
  constructor(private readonly db: DatabaseSync) {}

  findAll(): Coin[] {
    const statement = this.db.prepare(`
      SELECT id, symbol, pair, created_at
      FROM coins
      ORDER BY id
    `);

    return statement.all() as unknown as Coin[];
  }

  findById(id: number): Coin | null {
    const statement = this.db.prepare(`
      SELECT id, symbol, pair, created_at
      FROM coins
      WHERE id = ?
    `);

    const coin = statement.get(id);

    return (coin as unknown as Coin) ?? null;
  }

  create(symbol: string): Coin {
    const pair = `${symbol}USDT`;
    const createdAt = new Date().toISOString();

    const statement = this.db.prepare(`
      INSERT INTO coins (symbol, pair, created_at)
      VALUES (?, ?, ?)
    `);

    const result = statement.run(symbol, pair, createdAt);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, symbol: string): Coin | null {
    const pair = `${symbol}USDT`;

    const statement = this.db.prepare(`
      UPDATE coins
      SET symbol = ?, pair = ?
      WHERE id = ?
    `);

    const result = statement.run(symbol, pair, id);

    if (result.changes === 0) {
      return null;
    }

    return this.findById(id);
  }

  delete(id: number): boolean {
    const statement = this.db.prepare(`
      DELETE FROM coins
      WHERE id = ?
    `);

    const result = statement.run(id);

    return result.changes > 0;
  }
}