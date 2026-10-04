import axios from 'axios';

export interface BinancePrice {
  symbol: string;
  price: string;
}

export type BinanceErrorCode =
  | 'BINANCE_TIMEOUT'
  | 'BINANCE_API_ERROR'
  | 'BINANCE_INVALID_RESPONSE';

export class BinanceClientError extends Error {
  constructor(
    public readonly code: BinanceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'BinanceClientError';
  }
}

export class BinanceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = (
      process.env.BINANCE_BASE_URL ?? 'https://api.binance.com'
    ).replace(/\/+$/, '');

    this.timeoutMs = Number(
      process.env.BINANCE_TIMEOUT_MS ?? 5000
    );
  }

  async getPrice(pair: string): Promise<BinancePrice> {
    try {
      const response = await axios.get<BinancePrice>(
        `${this.baseUrl}/api/v3/ticker/price`,
        {
          params: {
            symbol: pair
          },
          timeout: this.timeoutMs
        }
      );

      const data = response.data;

      if (
        !data ||
        typeof data.symbol !== 'string' ||
        typeof data.price !== 'string' ||
        data.symbol !== pair
      ) {
        throw new BinanceClientError(
          'BINANCE_INVALID_RESPONSE',
          'Binance returned an invalid response'
        );
      }

      return data;
    } catch (error) {
      if (error instanceof BinanceClientError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT'
        ) {
          throw new BinanceClientError(
            'BINANCE_TIMEOUT',
            'Binance request timed out'
          );
        }

        throw new BinanceClientError(
          'BINANCE_API_ERROR',
          'Binance API request failed'
        );
      }

      throw new BinanceClientError(
        'BINANCE_API_ERROR',
        'Unexpected Binance API error'
      );
    }
  }
}