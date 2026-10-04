import { Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { CoinsRepository } from './coins.repository';
import { validateSymbol } from './coins.validation';
import {
  BinanceClient,
  BinanceClientError
} from '../binance/binance.client';

export function createCoinsRouter(db: DatabaseSync): Router {
  const router = Router();
  const repository = new CoinsRepository(db);
  const binanceClient = new BinanceClient();

  router.get('/', (req, res) => {
    const coins = repository.findAll();

    res.json(coins);
  });

  router.get('/:id/price', async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid coin id'
        }
      });

      return;
    }

    const coin = repository.findById(id);

    if (!coin) {
      res.status(404).json({
        error: {
          code: 'COIN_NOT_FOUND',
          message: 'Coin not found'
        }
      });

      return;
    }

    try {
      const result = await binanceClient.getPrice(coin.pair);

      res.json({
        coin_id: coin.id,
        symbol: coin.symbol,
        pair: coin.pair,
        price: result.price,
        source: 'Binance',
        fetched_at: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof BinanceClientError) {
        const status =
          error.code === 'BINANCE_TIMEOUT' ? 504 : 502;

        res.status(status).json({
          error: {
            code: error.code,
            message: error.message
          }
        });

        return;
      }

      throw error;
    }
  });

  router.post('/', (req, res) => {
    const symbol = validateSymbol(req.body?.symbol);

    if (!symbol) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid symbol'
        }
      });

      return;
    }

    try {
      const coin = repository.create(symbol);

      res.status(201).json(coin);
    } catch {
      res.status(409).json({
        error: {
          code: 'COIN_ALREADY_EXISTS',
          message: 'Coin is already tracked'
        }
      });
    }
  });

  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid coin id'
        }
      });

      return;
    }

    const symbol = validateSymbol(req.body?.symbol);

    if (!symbol) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid symbol'
        }
      });

      return;
    }

    try {
      const coin = repository.update(id, symbol);

      if (!coin) {
        res.status(404).json({
          error: {
            code: 'COIN_NOT_FOUND',
            message: 'Coin not found'
          }
        });

        return;
      }

      res.json(coin);
    } catch {
      res.status(409).json({
        error: {
          code: 'COIN_ALREADY_EXISTS',
          message: 'Coin is already tracked'
        }
      });
    }
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid coin id'
        }
      });

      return;
    }

    const deleted = repository.delete(id);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'COIN_NOT_FOUND',
          message: 'Coin not found'
        }
      });

      return;
    }

    res.status(204).send();
  });

  return router;
}