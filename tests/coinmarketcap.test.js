const axiosModule = require('axios');
const axios = axiosModule.default ?? axiosModule;

const {
  CoinMarketCapClient,
  CoinMarketCapClientError
} = require(
  '../dist/coinmarketcap/coinmarketcap.client'
);


beforeEach(() => {
  process.env.CMC_API_KEY =
    'test-cmc-key';

  process.env.CMC_BASE_URL =
    'https://pro-api.coinmarketcap.com';

  process.env.CMC_TIMEOUT_MS =
    '5000';

  process.env.PRICE_CURRENCY =
    'USD';
});


afterEach(() => {
  jest.restoreAllMocks();
});


function axiosError(status) {
  const error = new Error(
    'CMC request failed'
  );

  error.isAxiosError = true;

  error.response = {
    status
  };

  return error;
}


describe('CoinMarketCapClient', () => {
  test('parses successful quote', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValue({
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

    const client =
      new CoinMarketCapClient();

    const quote =
      await client.getQuoteBySymbol(
        'BTC'
      );

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


  test('maps 401 to CMC_AUTH_ERROR', async () => {
    jest
      .spyOn(axios, 'get')
      .mockRejectedValue(
        axiosError(401)
      );

    const client =
      new CoinMarketCapClient();

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
        axiosError(429)
      );

    const client =
      new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('BTC')
    ).rejects.toMatchObject({
      code: 'CMC_RATE_LIMIT'
    });
  });


  test('maps timeout to CMC_TIMEOUT', async () => {
    const error = new Error(
      'timeout'
    );

    error.isAxiosError = true;
    error.code = 'ECONNABORTED';

    jest
      .spyOn(axios, 'get')
      .mockRejectedValue(error);

    const client =
      new CoinMarketCapClient();

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

    const client =
      new CoinMarketCapClient();

    await expect(
      client.getQuoteBySymbol('BTC')
    ).rejects.toMatchObject({
      code: 'CMC_INVALID_RESPONSE'
    });
  });


  test('does not expose API key in returned data', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValue({
        data: {
          data: [
            {
              id: 1,
              name: 'Bitcoin',
              symbol: 'BTC',
              quote: [
                {
                  symbol: 'USD',
                  price: 100000,
                  last_updated:
                    '2026-10-06T12:00:00.000Z'
                }
              ]
            }
          ]
        }
      });

    const client =
      new CoinMarketCapClient();

    const quote =
      await client.getQuoteBySymbol(
        'BTC'
      );

    expect(
      JSON.stringify(quote)
    ).not.toContain('test-cmc-key');
  });
});