import { DatabaseSync } from 'node:sqlite';

export interface PriceHistoryRecord {
  id: number;
  coin_id: number;
  price: string;
  recorded_at: number;
}

export class PricesRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(
    coinId: number,
    price: string,
    recordedAt: number = Date.now()
  ): PriceHistoryRecord {
    const statement = this.db.prepare(`
      INSERT INTO price_history (coin_id, price, recorded_at)
      VALUES (?, ?, ?)
    `);

    const result = statement.run(
      coinId,
      price,
      recordedAt
    );

    const record = this.db.prepare(`
      SELECT id, coin_id, price, recorded_at
      FROM price_history
      WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return record as unknown as PriceHistoryRecord;
  }

  findByCoinId(
    coinId: number,
    limit: number = 100
  ): PriceHistoryRecord[] {
    const statement = this.db.prepare(`
      SELECT id, coin_id, price, recorded_at
      FROM price_history
      WHERE coin_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `);

    return statement.all(
      coinId,
      limit
    ) as unknown as PriceHistoryRecord[];
  }
}