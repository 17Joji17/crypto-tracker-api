import { DatabaseSync } from 'node:sqlite';

export interface Coin {
  id: number;
  cmc_id: number;
  symbol: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class CoinsRepository {
  constructor(private readonly db: DatabaseSync) {}

  findAll(): Coin[] {
    const statement = this.db.prepare(`
      SELECT
        id,
        cmc_id,
        symbol,
        name,
        created_at,
        updated_at
      FROM coins
      ORDER BY id
    `);

    return statement.all() as unknown as Coin[];
  }

  findById(id: number): Coin | null {
    const statement = this.db.prepare(`
      SELECT
        id,
        cmc_id,
        symbol,
        name,
        created_at,
        updated_at
      FROM coins
      WHERE id = ?
    `);

    const coin = statement.get(id);

    return (coin as unknown as Coin) ?? null;
  }

  create(
    cmcId: number,
    symbol: string,
    name: string,
    updatedAt: string
  ): Coin {
    const createdAt = new Date().toISOString();

    const statement = this.db.prepare(`
      INSERT INTO coins (
        cmc_id,
        symbol,
        name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = statement.run(
      cmcId,
      symbol,
      name,
      createdAt,
      updatedAt
    );

    return this.findById(
      Number(result.lastInsertRowid)
    )!;
  }

  update(
    id: number,
    cmcId: number,
    symbol: string,
    name: string,
    updatedAt: string
  ): Coin | null {
    const statement = this.db.prepare(`
      UPDATE coins
      SET
        cmc_id = ?,
        symbol = ?,
        name = ?,
        updated_at = ?
      WHERE id = ?
    `);

    const result = statement.run(
      cmcId,
      symbol,
      name,
      updatedAt,
      id
    );

    if (result.changes === 0) {
      return null;
    }

    return this.findById(id);
  }

  updateLastUpdated(
    id: number,
    updatedAt: string
  ): void {
    const statement = this.db.prepare(`
      UPDATE coins
      SET updated_at = ?
      WHERE id = ?
    `);

    statement.run(updatedAt, id);
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