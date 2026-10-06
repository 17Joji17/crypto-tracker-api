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
  CoinsRepository
} = require('../dist/coins/coins.repository');

const {
  PricesRepository
} = require('../dist/prices/prices.repository');

const {
  PriceSyncJob
} = require('../dist/jobs/price-sync.job');


let tempDirectory;
let db;
let coinsRepository;
let pricesRepository;


beforeEach(() => {
  tempDirectory = mkdtempSync(
    join(
      tmpdir(),
      'crypto-sync-test-'
    )
  );

  db = createDatabase(
    join(
      tempDirectory,
      'test.sqlite'
    )
  );

  coinsRepository =
    new CoinsRepository(db);

  pricesRepository =
    new PricesRepository(db);
});


afterEach(() => {
  jest.useRealTimers();
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


function createBtc() {
  return coinsRepository.create(
    1,
    'BTC',
    'Bitcoin',
    '2026-10-06T12:00:00.000Z'
  );
}


describe('PriceSyncJob', () => {
  test('saves synchronized price to SQLite', async () => {
    const coin = createBtc();

    const client = {
      getQuotesByIds:
        jest.fn().mockResolvedValue([
          {
            cmcId: 1,
            name: 'Bitcoin',
            symbol: 'BTC',
            price: '100000.5',
            currency: 'USD',
            lastUpdated:
              '2026-10-06T13:00:00.000Z'
          }
        ])
    };

    const job = new PriceSyncJob(
      coinsRepository,
      pricesRepository,
      client,
      60000
    );

    await job.syncOnce();

    const history =
      pricesRepository.findByCoinId(
        coin.id
      );

    expect(history).toHaveLength(1);

    expect(history[0].price)
      .toBe('100000.5');

    const updatedCoin =
      coinsRepository.findById(
        coin.id
      );

    expect(updatedCoin.updated_at)
      .toBe(
        '2026-10-06T13:00:00.000Z'
      );
  });


  test('handles external API failure without crashing', async () => {
    const coin = createBtc();

    const client = {
      getQuotesByIds:
        jest.fn().mockRejectedValue(
          new Error('API unavailable')
        )
    };

    jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const job = new PriceSyncJob(
      coinsRepository,
      pricesRepository,
      client,
      60000
    );

    await expect(
      job.syncOnce()
    ).resolves.toBeUndefined();

    const history =
      pricesRepository.findByCoinId(
        coin.id
      );

    expect(history).toHaveLength(0);
  });


  test('stops scheduled synchronization', async () => {
    jest.useFakeTimers();

    createBtc();

    const client = {
      getQuotesByIds:
        jest.fn().mockResolvedValue([
          {
            cmcId: 1,
            name: 'Bitcoin',
            symbol: 'BTC',
            price: '100000.5',
            currency: 'USD',
            lastUpdated:
              '2026-10-06T13:00:00.000Z'
          }
        ])
    };

    jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const job = new PriceSyncJob(
      coinsRepository,
      pricesRepository,
      client,
      60000
    );

    job.start();

    await jest.advanceTimersByTimeAsync(
      0
    );

    expect(
      client.getQuotesByIds
    ).toHaveBeenCalledTimes(1);

    await job.stop();

    expect(
      jest.getTimerCount()
    ).toBe(0);
  });
});