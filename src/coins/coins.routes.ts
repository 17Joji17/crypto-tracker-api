import { Response, Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { CoinsRepository } from './coins.repository';
import { validateSymbol } from './coins.validation';
import {
  CoinMarketCapClient,
  CoinMarketCapClientError
} from '../coinmarketcap/coinmarketcap.client';
import { PricesRepository } from '../prices/prices.repository';

function sendCmcError(
    res: Response,
    error: CoinMarketCapClientError
  ): void {
    let status = 502;

    if (error.code === 'CMC_TIMEOUT') {
      status = 504;
    } else if (error.code === 'CMC_RATE_LIMIT') {
      status = 503;
    } else if (
      error.code === 'CMC_CONFIGURATION_ERROR'
    ) {
      status = 500;
    }

    res.status(status).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

export function createCoinsRouter(db: DatabaseSync): Router {
  const router = Router();
  const repository = new CoinsRepository(db);
  const pricesRepository = new PricesRepository(db);
  const coinMarketCapClient = new CoinMarketCapClient();
  router.get('/', (req, res) => {
    const coins = repository.findAll();

    res.json(coins);
  });

  router.get('/:id/history', (req, res) => {
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

    let limit = 100;

    if (req.query.limit !== undefined) {
      if (
        typeof req.query.limit !== 'string' ||
        !/^\d+$/.test(req.query.limit)
      ) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid limit'
          }
        });

        return;
      }

      limit = Number(req.query.limit);

      if (limit < 1 || limit > 1000) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Limit must be between 1 and 1000'
          }
        });

        return;
      }
    }

    const history = pricesRepository
      .findByCoinId(id, limit)
      .map((record) => ({
        id: record.id,
        price: record.price,
        recorded_at: new Date(record.recorded_at).toISOString()
      }));

    res.json({
      coin: {
        id: coin.id,
        cmc_id: coin.cmc_id,
        symbol: coin.symbol,
        name: coin.name
      },
      history
    });
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
    const quote =
      await coinMarketCapClient.getQuoteById(
        coin.cmc_id
      );

    repository.updateLastUpdated(
      coin.id,
      quote.lastUpdated
    );

    res.json({
      coin_id: coin.id,
      cmc_id: coin.cmc_id,
      symbol: coin.symbol,
      name: coin.name,
      price: quote.price,
      currency: quote.currency,
      source: 'CoinMarketCap',
      updated_at: quote.lastUpdated,
      fetched_at: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof CoinMarketCapClientError) {
      sendCmcError(res, error);
      return;
    }

    throw error;
  }
});

router.post('/', async (req, res) => {
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

  let quote;

  try {
    quote =
      await coinMarketCapClient.getQuoteBySymbol(
        symbol
      );
  } catch (error) {
    if (error instanceof CoinMarketCapClientError) {
      if (
        error.code ===
        'CMC_CRYPTOCURRENCY_NOT_FOUND'
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_CRYPTOCURRENCY',
            message:
              'Cryptocurrency was not found in CoinMarketCap'
          }
        });

        return;
      }

      sendCmcError(res, error);
      return;
    }

    throw error;
  }

  try {
    const coin = repository.create(
      quote.cmcId,
      quote.symbol,
      quote.name,
      quote.lastUpdated
    );

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

  router.put('/:id', async (req, res) => {
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

  if (!repository.findById(id)) {
    res.status(404).json({
      error: {
        code: 'COIN_NOT_FOUND',
        message: 'Coin not found'
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

  let quote;

  try {
    quote =
      await coinMarketCapClient.getQuoteBySymbol(
        symbol
      );
  } catch (error) {
    if (error instanceof CoinMarketCapClientError) {
      if (
        error.code ===
        'CMC_CRYPTOCURRENCY_NOT_FOUND'
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_CRYPTOCURRENCY',
            message:
              'Cryptocurrency was not found in CoinMarketCap'
          }
        });

        return;
      }

      sendCmcError(res, error);
      return;
    }

    throw error;
  }

  try {
    const coin = repository.update(
      id,
      quote.cmcId,
      quote.symbol,
      quote.name,
      quote.lastUpdated
    );

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