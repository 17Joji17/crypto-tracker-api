import axios from 'axios';

interface CmcQuoteData {
  symbol: string;
  price: number;
  last_updated: string;
}

interface CmcAsset {
  id: number;
  name: string;
  symbol: string;
  quote: CmcQuoteData[];
}

export interface CoinMarketCapQuote {
  cmcId: number;
  name: string;
  symbol: string;
  price: string;
  currency: string;
  lastUpdated: string;
}

export type CoinMarketCapErrorCode =
  | 'CMC_TIMEOUT'
  | 'CMC_API_ERROR'
  | 'CMC_AUTH_ERROR'
  | 'CMC_RATE_LIMIT'
  | 'CMC_INVALID_RESPONSE'
  | 'CMC_CRYPTOCURRENCY_NOT_FOUND'
  | 'CMC_CONFIGURATION_ERROR';

export class CoinMarketCapClientError extends Error {
  constructor(
    public readonly code: CoinMarketCapErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CoinMarketCapClientError';
  }
}

export class CoinMarketCapClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly currency: string;

  constructor() {
    this.baseUrl = (
      process.env.CMC_BASE_URL ??
      'https://pro-api.coinmarketcap.com'
    ).replace(/\/+$/, '');

    this.apiKey = process.env.CMC_API_KEY ?? '';

    this.timeoutMs = Number(
      process.env.CMC_TIMEOUT_MS ?? 5000
    );

    this.currency = (
      process.env.PRICE_CURRENCY ?? 'USD'
    ).toUpperCase();
  }

  async getQuoteBySymbol(
    symbol: string
  ): Promise<CoinMarketCapQuote> {
    const assets = await this.request({
      symbol: symbol.toUpperCase()
    });

    const asset =
      assets.find(
        (item) =>
          item.symbol.toUpperCase() === symbol.toUpperCase()
      ) ?? assets[0];

    if (!asset) {
      throw new CoinMarketCapClientError(
        'CMC_CRYPTOCURRENCY_NOT_FOUND',
        'Cryptocurrency was not found in CoinMarketCap'
      );
    }

    return this.toQuote(asset);
  }

  async getQuoteById(
    cmcId: number
  ): Promise<CoinMarketCapQuote> {
    const assets = await this.request({
      id: String(cmcId)
    });

    const asset = assets.find(
      (item) => item.id === cmcId
    );

    if (!asset) {
      throw new CoinMarketCapClientError(
        'CMC_CRYPTOCURRENCY_NOT_FOUND',
        'Cryptocurrency was not found in CoinMarketCap'
      );
    }

    return this.toQuote(asset);
  }

  async getQuotesByIds(
    cmcIds: number[]
  ): Promise<CoinMarketCapQuote[]> {
    if (cmcIds.length === 0) {
      return [];
    }

    const assets = await this.request({
      id: cmcIds.join(',')
    });

    return assets.map((asset) =>
      this.toQuote(asset)
    );
  }

  private async request(
    lookup: Record<string, string>
  ): Promise<CmcAsset[]> {
    if (!this.apiKey) {
      throw new CoinMarketCapClientError(
        'CMC_CONFIGURATION_ERROR',
        'CoinMarketCap API key is not configured'
      );
    }

    try {
      const response = await axios.get<unknown>(
        `${this.baseUrl}/v3/cryptocurrency/quotes/latest`,
        {
          headers: {
            Accept: 'application/json',
            'X-CMC_PRO_API_KEY': this.apiKey
          },
          params: {
            ...lookup,
            convert: this.currency,
            skip_invalid: 'true'
          },
          timeout: this.timeoutMs
        }
      );

      let data: unknown;

      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (
        typeof response.data === 'object' &&
        response.data !== null &&
        'data' in response.data
      ) {
        data = (
          response.data as { data?: unknown }
        ).data;
      }

      if (!Array.isArray(data)) {
        throw new CoinMarketCapClientError(
          'CMC_INVALID_RESPONSE',
          'CoinMarketCap returned an invalid response'
        );
      }

      return data as CmcAsset[];
    } catch (error) {
      if (error instanceof CoinMarketCapClientError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT'
        ) {
          throw new CoinMarketCapClientError(
            'CMC_TIMEOUT',
            'CoinMarketCap request timed out'
          );
        }

        const status = error.response?.status;

        if (status === 401 || status === 403) {
          throw new CoinMarketCapClientError(
            'CMC_AUTH_ERROR',
            'CoinMarketCap authentication failed'
          );
        }

        if (status === 429) {
          throw new CoinMarketCapClientError(
            'CMC_RATE_LIMIT',
            'CoinMarketCap rate limit exceeded'
          );
        }

        throw new CoinMarketCapClientError(
          'CMC_API_ERROR',
          'CoinMarketCap API request failed'
        );
      }

      throw new CoinMarketCapClientError(
        'CMC_API_ERROR',
        'Unexpected CoinMarketCap API error'
      );
    }
  }

  private toQuote(
    asset: CmcAsset
  ): CoinMarketCapQuote {
    if (
      !asset ||
      typeof asset.id !== 'number' ||
      typeof asset.name !== 'string' ||
      typeof asset.symbol !== 'string' ||
      !Array.isArray(asset.quote)
    ) {
      throw new CoinMarketCapClientError(
        'CMC_INVALID_RESPONSE',
        'CoinMarketCap returned an invalid cryptocurrency'
      );
    }

    const quote = asset.quote.find(
      (item) =>
        item.symbol.toUpperCase() === this.currency
    );

    if (
      !quote ||
      typeof quote.price !== 'number' ||
      !Number.isFinite(quote.price) ||
      typeof quote.last_updated !== 'string'
    ) {
      throw new CoinMarketCapClientError(
        'CMC_INVALID_RESPONSE',
        'CoinMarketCap returned an invalid price'
      );
    }

    return {
      cmcId: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      price: String(quote.price),
      currency: this.currency,
      lastUpdated: quote.last_updated
    };
  }
}