import { CoinsRepository } from '../coins/coins.repository';
import { PricesRepository } from '../prices/prices.repository';
import { CoinMarketCapClient } from '../coinmarketcap/coinmarketcap.client';

export class PriceSyncJob {
  private timer: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly coinsRepository: CoinsRepository,
    private readonly pricesRepository: PricesRepository,
    private readonly coinMarketCapClient: CoinMarketCapClient,
    private readonly intervalMs: number
  ) {}

  start(): void {
    if (this.timer || this.currentRun) {
      return;
    }

    this.stopping = false;
    this.scheduleNext(0);
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.currentRun) {
      await this.currentRun;
    }
  }

  async syncOnce(): Promise<void> {
    const coins = this.coinsRepository.findAll();

    if (coins.length === 0) {
      return;
    }

    try {
      const quotes =
        await this.coinMarketCapClient.getQuotesByIds(
          coins.map((coin) => coin.cmc_id)
        );

      const quotesById = new Map(
        quotes.map((quote) => [
          quote.cmcId,
          quote
        ])
      );

      for (const coin of coins) {
        const quote = quotesById.get(coin.cmc_id);

        if (!quote) {
          console.error(
            `No CoinMarketCap quote for ${coin.symbol}`
          );
          continue;
        }

        this.pricesRepository.create(
          coin.id,
          quote.price
        );

        this.coinsRepository.updateLastUpdated(
          coin.id,
          quote.lastUpdated
        );

        console.log(
          `Price synced: ${coin.symbol} = ${quote.price} ${quote.currency}`
        );
      }
    } catch (error) {
      console.error(
        'Failed to synchronize CoinMarketCap prices:',
        error
      );
    }
  }

  private scheduleNext(delay: number): void {
    this.timer = setTimeout(() => {
      this.timer = null;

      this.currentRun = this.syncOnce()
        .catch((error) => {
          console.error(
            'Price synchronization failed:',
            error
          );
        })
        .finally(() => {
          this.currentRun = null;

          if (!this.stopping) {
            this.scheduleNext(this.intervalMs);
          }
        });
    }, delay);
  }
}