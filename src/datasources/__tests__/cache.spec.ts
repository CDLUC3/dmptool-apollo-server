import { Cache } from '../cache';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import { logger } from "../../logger";

jest.mock('keyv');
jest.mock('@keyv/redis');
jest.mock('@apollo/utils.keyvadapter');

describe('Cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a Redis cluster and initialize KeyvAdapter', () => {
    Cache.getInstance();

    expect(KeyvRedis).toHaveBeenCalledWith(
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
    expect(Keyv).toHaveBeenCalledWith(
      expect.objectContaining({ store: expect.any(KeyvRedis) }),
    );
    expect(KeyvAdapter).toHaveBeenCalledWith(expect.any(Keyv), { disableBatchReads: true });
    Cache.destroy();
  });

  it('should log when Redis connection is established, encounters an error, or is closed', () => {
    const onSpy = jest.spyOn(Keyv.prototype, 'on');

    // Ensure event handlers were attached to the Keyv instance
    Cache.getInstance();
    expect(onSpy).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function))
    expect(onSpy).toHaveBeenCalledWith('close', expect.any(Function))

    const connectCallback = onSpy.mock.calls.find(call => call[0] === 'connect')[1];
    connectCallback();
    expect(logger.info).toHaveBeenCalledWith({}, 'Redis connection established');

    const errorCallback = onSpy.mock.calls.find(call => call[0] === 'error')?.[1];
    const mockError = new Error('Test Error');
    errorCallback(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, 'Redis connection error - Test Error');

    const closeCallback = onSpy.mock.calls.find(call => call[0] === 'close')?.[1];
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
