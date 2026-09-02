/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// Keyv / KeyvRedis / KeyvAdapter each need to be constructor-style mocks
// (jest.fn() with a manually-populated .prototype), not bare jest.fn()s —
// the tests need to both track constructor calls
// (expect(Keyv).toHaveBeenCalledWith(...)) AND, for Keyv specifically, spy
// on a real prototype method (jest.spyOn(Keyv.prototype, 'on')). A plain
// jest.fn() automock has neither a meaningfully-populated prototype nor
// real construction semantics for `new Keyv(...)` to attach `this.store` to
// — same pattern as the VersionedGuidanceGroup constructor mock elsewhere
// in this migration.
// ---------------------------------------------------------------------------
const mockKeyvOn = jest.fn<(...args: any[]) => any>();
const MockKeyv: any = jest.fn().mockImplementation(function (this: any, options: any) {
  this.store = options?.store;
});
MockKeyv.prototype.on = mockKeyvOn;

jest.unstable_mockModule('keyv', () => ({
  __esModule: true,
  default: MockKeyv,
}));

const MockKeyvRedis: any = jest.fn().mockImplementation(function (this: any, ...args: any[]) {
  this._args = args;
});

jest.unstable_mockModule('@keyv/redis', () => ({
  __esModule: true,
  default: MockKeyvRedis,
}));

const MockKeyvAdapter: any = jest.fn().mockImplementation(function (this: any, ...args: any[]) {
  this._args = args;
});

jest.unstable_mockModule('@apollo/utils.keyvadapter', () => ({
  __esModule: true,
  KeyvAdapter: MockKeyvAdapter,
}));

// ---------------------------------------------------------------------------
// cache.js is dynamic and imported after the mocks above (rather than
// statically, which would be hoisted above them regardless of textual
// position) — it transitively imports cacheConfig.js, which validates its
// env vars (CACHE_PORT, etc.) at import time and needs mockAppConfigs() to
// already be in place before that happens.
// ---------------------------------------------------------------------------
const { Cache } = await import('../cache.js');
const { logger } = await import('../../logger.js');

const getEventHandler = (
  calls: [string, (...args: any[]) => void][],
  eventName: string
): ((...args: any[]) => void) => {
  const handler = calls.find(([event]) => event === eventName)?.[1];
  expect(handler).toBeDefined();
  return handler as (...args: any[]) => void;
};

describe('Cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a Redis cluster and initialize KeyvAdapter', () => {
    Cache.getInstance();

    expect(MockKeyvRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host: 'localhost',
          port: 6379,
          connectTimeout: 10000,
          reconnectStrategy: expect.any(Function),
        })
      }),
      {
        throwOnConnectError: true
      }
    );
    expect(MockKeyv).toHaveBeenCalledWith(
      expect.objectContaining({ store: expect.any(MockKeyvRedis) }),
    );
    expect(MockKeyvAdapter).toHaveBeenCalledWith(expect.any(MockKeyv), { disableBatchReads: true });
    Cache.destroy();
  });

  it('should log when Redis connection is established, encounters an error, or is closed', () => {
    const onSpy = jest.spyOn(MockKeyv.prototype, 'on');

    // Ensure event handlers were attached to the Keyv instance
    Cache.getInstance();
    expect(onSpy).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function))
    expect(onSpy).toHaveBeenCalledWith('close', expect.any(Function))

    const connectCallback = getEventHandler(
      onSpy.mock.calls as [string, (...args: any[]) => void][],
      'connect'
    );
    connectCallback();
    expect(logger.info).toHaveBeenCalledWith({}, 'Redis connection established');

    const errorCallback = getEventHandler(
      onSpy.mock.calls as [string, (...args: any[]) => void][],
      'error'
    );
    const mockError = new Error('Test Error');
    errorCallback(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, 'Redis connection error - Test Error');

    const closeCallback = getEventHandler(
      onSpy.mock.calls as [string, (...args: any[]) => void][],
      'close'
    );
    closeCallback();
    expect(logger.info).toHaveBeenCalledWith({}, 'Redis connection closed');

    onSpy.mockRestore();
    Cache.destroy();
  });

  it('should follow the singleton pattern', () => {
    const instance1 = Cache.getInstance();
    const instance2 = Cache.getInstance();

    // Ensure that both instances are the same (singleton)
    expect(instance1).toBe(instance2);
    Cache.destroy();
  });
});