const request = require('supertest');
const axiosModule = require('axios');
const axios = axiosModule.default ?? axiosModule;

const {
  mkdtempSync,
  rmSync
} = require('node:fs');

const {
  tmpdir
} = require('node:os');

const {
  join
} = require('node:path');

const {
  createDatabase
} = require('../dist/db/database');

const {
  createApp
} = require('../dist/app');

const {
  CoinsRepository
} = require('../dist/coins/coins.repository');

const {
  PricesRepository
} = require('../dist/prices/prices.repository');


const API_KEY = 'test-api-key';

const AUTH = {
  Authorization: `Bearer ${API_KEY}`
};

const BTC_RESPONSE = {
  data: [
    {
      id: 1,
      name: 'Bitcoin',
      symbol: 'BTC',
      quote: [
        {
          symbol: 'USD',
          price: 100000.5,
          last_updated: '2026-10-06T12:00:00.000Z'
        }
      ]
    }
  ]
};

const ETH_RESPONSE = {
  data: [
    {
      id: 1027,
      name: 'Ethereum',
      symbol: 'ETH',
      quote: [
        {
          symbol: 'USD',
          price: 3500.25,
          last_updated: '2026-10-06T12:00:00.000Z'
        }
      ]
    }
  ]
};


let tempDirectory;
let db;
let app;
let coinsRepository;
let pricesRepository;


beforeEach(() => {
  process.env.API_KEY = API_KEY;
  process.env.CMC_API_KEY = 'test-cmc-key';
  process.env.CMC_BASE_URL =
    'https://pro-api.coinmarketcap.com';
  process.env.CMC_TIMEOUT_MS = '5000';
  process.env.PRICE_CURRENCY = 'USD';

  tempDirectory = mkdtempSync(
    join(tmpdir(), 'crypto-tracker-test-')
  );

  const dbPath = join(
    tempDirectory,
    'test.sqlite'
  );

  db = createDatabase(dbPath);

  coinsRepository =
    new CoinsRepository(db);

  pricesRepository =
    new PricesRepository(db);

  app = createApp(db);
});


afterEach(() => {
  jest.restoreAllMocks();

  db.close();

  rmSync(
    tempDirectory,
    {
      recursive: true,
      force: true
    }
  );
});


function mockCmcResponse(data) {
  jest
    .spyOn(axios, 'get')
    .mockResolvedValue({ data });
}


function createBtc() {
  return coinsRepository.create(
    1,
    'BTC',
    'Bitcoin',
    '2026-10-06T12:00:00.000Z'
  );
}


/*HEALTH*/

describe('GET /health', () => {
  test('returns service status', async () => {
    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok'
    });
  });

  test('rejects unsupported method', async () => {
    const response = await request(app)
      .post('/health');

    expect(response.status).toBe(404);
  });
});


/*GET COINS*/

describe('GET /api/coins', () => {
  test('returns tracked coins', async () => {
    createBtc();

    const response = await request(app)
      .get('/api/coins')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toMatchObject({
      cmc_id: 1,
      symbol: 'BTC',
      name: 'Bitcoin'
    });
  });

  test('rejects request without API key', async () => {
    const response = await request(app)
      .get('/api/coins');

    expect(response.status).toBe(401);

    expect(response.body.error.code)
      .toBe('UNAUTHORIZED');
  });
});


/*GET COIN*/

describe('GET /api/coins/:id', () => {
  test('returns tracked coin', async () => {
    const coin = createBtc();

    const response = await request(app)
      .get(`/api/coins/${coin.id}`)
      .set(AUTH);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      id: coin.id,
      cmc_id: 1,
      symbol: 'BTC',
      name: 'Bitcoin'
    });
  });

  test('returns 404 for unknown coin', async () => {
    const response = await request(app)
      .get('/api/coins/999999')
      .set(AUTH);

    expect(response.status).toBe(404);

    expect(response.body.error.code)
      .toBe('COIN_NOT_FOUND');
  });
});


/*POST COIN*/

describe('POST /api/coins', () => {
  test('creates cryptocurrency using CoinMarketCap data', async () => {
    mockCmcResponse(BTC_RESPONSE);

    const response = await request(app)
      .post('/api/coins')
      .set(AUTH)
      .send({
        symbol: 'BTC'
      });

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      cmc_id: 1,
      symbol: 'BTC',
      name: 'Bitcoin'
    });
  });

  test('rejects invalid symbol', async () => {
    const response = await request(app)
      .post('/api/coins')
      .set(AUTH)
      .send({
        symbol: '!!!'
      });

    expect(response.status).toBe(400);

    expect(response.body.error.code)
      .toBe('VALIDATION_ERROR');
  });

  test('rejects duplicate cryptocurrency', async () => {
    createBtc();

    mockCmcResponse(BTC_RESPONSE);

    const response = await request(app)
      .post('/api/coins')
      .set(AUTH)
      .send({
        symbol: 'BTC'
      });

    expect(response.status).toBe(409);

    expect(response.body.error.code)
      .toBe('COIN_ALREADY_EXISTS');
  });
});


/*PUT COIN*/

describe('PUT /api/coins/:id', () => {
  test('updates tracked cryptocurrency', async () => {
    const coin = createBtc();

    mockCmcResponse(ETH_RESPONSE);

    const response = await request(app)
      .put(`/api/coins/${coin.id}`)
      .set(AUTH)
      .send({
        symbol: 'ETH'
      });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      id: coin.id,
      cmc_id: 1027,
      symbol: 'ETH',
      name: 'Ethereum'
    });
  });

  test('returns 404 for unknown coin', async () => {
    const response = await request(app)
      .put('/api/coins/999999')
      .set(AUTH)
      .send({
        symbol: 'ETH'
      });

    expect(response.status).toBe(404);

    expect(response.body.error.code)
      .toBe('COIN_NOT_FOUND');
  });
});


/*DELETE COIN*/

describe('DELETE /api/coins/:id', () => {
  test('deletes tracked cryptocurrency', async () => {
    const coin = createBtc();

    const response = await request(app)
      .delete(`/api/coins/${coin.id}`)
      .set(AUTH);

    expect(response.status).toBe(204);

    expect(
      coinsRepository.findById(coin.id)
    ).toBeNull();
  });

  test('returns 404 for unknown coin', async () => {
    const response = await request(app)
      .delete('/api/coins/999999')
      .set(AUTH);

    expect(response.status).toBe(404);

    expect(response.body.error.code)
      .toBe('COIN_NOT_FOUND');
  });
});


/*CURRENT PRICE*/

describe('GET /api/coins/:id/price', () => {
  test('returns current CoinMarketCap price', async () => {
    const coin = createBtc();

    mockCmcResponse(BTC_RESPONSE);

    const response = await request(app)
      .get(`/api/coins/${coin.id}/price`)
      .set(AUTH);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      coin_id: coin.id,
      cmc_id: 1,
      symbol: 'BTC',
      name: 'Bitcoin',
      price: '100000.5',
      currency: 'USD',
      source: 'CoinMarketCap'
    });
  });

  test('returns timeout error when CoinMarketCap times out', async () => {
    const coin = createBtc();

    const error = new Error(
      'timeout'
    );

    error.code = 'ECONNABORTED';
    error.isAxiosError = true;

    jest
      .spyOn(axios, 'get')
      .mockRejectedValue(error);

    const response = await request(app)
      .get(`/api/coins/${coin.id}/price`)
      .set(AUTH);

    expect(response.status).toBe(504);

    expect(response.body.error.code)
      .toBe('CMC_TIMEOUT');
  });
});


/*HISTORY*/

describe('GET /api/coins/:id/history', () => {
  test('returns stored price history', async () => {
    const coin = createBtc();

    pricesRepository.create(
      coin.id,
      '100000.5',
      Date.parse(
        '2026-10-06T12:00:00.000Z'
      )
    );

    const response = await request(app)
      .get(`/api/coins/${coin.id}/history`)
      .set(AUTH);

    expect(response.status).toBe(200);

    expect(response.body.coin)
      .toMatchObject({
        id: coin.id,
        cmc_id: 1,
        symbol: 'BTC',
        name: 'Bitcoin'
      });

    expect(response.body.history)
      .toHaveLength(1);

    expect(response.body.history[0].price)
      .toBe('100000.5');
  });

  test('rejects invalid limit', async () => {
    const coin = createBtc();

    const response = await request(app)
      .get(
        `/api/coins/${coin.id}/history?limit=abc`
      )
      .set(AUTH);

    expect(response.status).toBe(400);

    expect(response.body.error.code)
      .toBe('VALIDATION_ERROR');
  });
});


/*INVALID JSON*/

describe('JSON error handling', () => {
  test('returns JSON error for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/coins')
      .set(AUTH)
      .set(
        'Content-Type',
        'application/json'
      )
      .send('{"symbol":');

    expect(response.status).toBe(400);

    expect(response.body.error.code)
      .toBe('INVALID_JSON');
  });
});