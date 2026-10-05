import { CoinsRepository } from '../coins/coins.repository';
import { PricesRepository } from '../prices/prices.repository';
import { BinanceClient } from '../binance/binance.client';

export class PriceSyncJob {
  private timer: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly coinsRepository: CoinsRepository,
    private readonly pricesRepository: PricesRepository,
    private readonly binanceClient: BinanceClient,
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

    for (const coin of coins) {
      try {
        const price = await this.binanceClient.getPrice(
          coin.pair
        );

        this.pricesRepository.create(
          coin.id,
          price.price
        );

        console.log(
          `Price synced: ${coin.pair} = ${price.price}`
        );
      } catch (error) {
        console.error(
          `Failed to sync price for ${coin.pair}:`,
          error
        );
      }
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