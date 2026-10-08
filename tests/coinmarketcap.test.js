const axiosModule = require('axios');
const axios = axiosModule.default ?? axiosModule;

const {
  CoinMarketCapClient
} = require(
  '../dist/coinmarketcap/coinmarketcap.client'
);

beforeEach(() => {
  process.env.CMC_API_KEY = 'test-cmc-key';
  process.env.CMC_BASE_URL =
    'https://pro-api.coinmarketcap.com';
  process.env.CMC_TIMEOUT_MS = '5000';
  process.env.PRICE_CURRENCY = 'USD';
});

afterEach(() => {
  jest.restoreAllMocks();
});

function createAxiosError(status) {
  const error = new Error('CoinMarketCap request failed');

  error.isAxiosError = true;
  error.response = {
    status
  };

  return error;
}

function mockBitcoinMapAndQuote() {
  return jest
    .spyOn(axios, 'get')
    .mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 1,
            name: 'Bitcoin',
            symbol: 'BTC',
            rank: 1,
            is_active: 1
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 1,
            name: 'Bitcoin',
            symbol: 'BTC',
            quote: [
              {
                symbol: 'USD',
                price: 100000.5,
                last_updated:
                  '2026-10-06T12:00:00.000Z'
              }
            ]
          }
        ]
      }
    });
}

describe('CoinMarketCapClient', () => {
  test('parses successful quote', async () => {
    mockBitcoinMapAndQuote();

    const client = new CoinMarketCapClient();

    const quote =
      await client.getQuoteBySymbol('BTC');

    expect(quote).toEqual({
      cmcId: 1,
      name: 'Bitcoin',
      symbol: 'BTC',
      price: '100000.5',
      currency: 'USD',
      lastUpdated:
        '2026-10-06T12:00:00.000Z'
    });
  });

  test('resolves symbol to CMC ID before requesting quote', async () => {
    const axiosSpy = jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 5426,
              name: 'Solana',
              symbol: 'SOL',
              rank: 6,
              is_active: 1
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 5426,
              name: 'Solana',
              symbol: 'SOL',
              quote: [
                {
                  symbol: 'USD',
                  price: 180.5,
                  last_updated:
                    '2026-10-08T16:00:00.000Z'
                }
              ]
            }
          ]
        }
      });

    const client = new CoinMarketCapClient();

    const quote =
      await client.getQuoteBySymbol('SOL');

    expect(quote).toMatchObject({
      cmcId: 5426,
      name: 'Solana',
      symbol: 'SOL',
      price: '180.5',
      currency: 'USD'
    });

    expect(axiosSpy).toHaveBeenCalledTimes(2);

    expect(
      axiosSpy.mock.calls[0][0]
    ).toContain(
      '/v1/cryptocurrency/map'
    );

    expect(
      axiosSpy.mock.calls[0][1].params.symbol
    ).toBe('SOL');

    expect(
      axiosSpy.mock.calls[1][0]
    ).toContain(
      '/v3/cryptocurrency/quotes/latest'
    );

    expect(
      axiosSpy.mock.calls[1][1].params.id
    ).toBe('5426');
  });

  test('maps 401 to CMC_AUTH_ERROR', async () => {
    jest
      .spyOn(axios, 'get')
      .mockRejectedValue(
        createAxiosError(401)
      );

    const client = new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('BTC')
    ).rejects.toMatchObject({
      code: 'CMC_AUTH_ERROR'
    });
  });

  test('maps 429 to CMC_RATE_LIMIT', async () => {
    jest
      .spyOn(axios, 'get')
      .mockRejectedValue(
        createAxiosError(429)
      );

    const client = new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('BTC')
    ).rejects.toMatchObject({
      code: 'CMC_RATE_LIMIT'
    });
  });

  test('maps timeout to CMC_TIMEOUT', async () => {
    const error = new Error('timeout');

    error.isAxiosError = true;
    error.code = 'ECONNABORTED';

    jest
      .spyOn(axios, 'get')
      .mockRejectedValue(error);

    const client = new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('BTC')
    ).rejects.toMatchObject({
      code: 'CMC_TIMEOUT'
    });
  });

  test('rejects invalid response', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValue({
        data: {
          hello: 'world'
        }
      });

    const client = new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('BTC')
    ).rejects.toMatchObject({
      code: 'CMC_INVALID_RESPONSE'
    });
  });

  test('returns not found for unknown symbol', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValue({
        data: {
          data: []
        }
      });

    const client = new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('FAKECOINXYZ')
    ).rejects.toMatchObject({
      code: 'CMC_CRYPTOCURRENCY_NOT_FOUND'
    });
  });

  test('does not expose API key in returned data', async () => {
    mockBitcoinMapAndQuote();

    const client = new CoinMarketCapClient();

    const quote =
      await client.getQuoteBySymbol('BTC');

    expect(
      JSON.stringify(quote)
    ).not.toContain('test-cmc-key');
  });
});