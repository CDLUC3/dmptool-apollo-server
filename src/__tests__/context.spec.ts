/*eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

import { mockAppConfigs } from './mockConfigs.js';

mockAppConfigs();

import type { DMPHubAPI } from '../datasources/dmphubAPI.js';
import type { MySQLConnection } from '../datasources/mysql.js';
import type { Logger } from 'pino';
import type { JWTAccessToken } from '../services/tokenService.js';

const mockRandomHex = jest.fn<(...args: any[]) => string>();
const actualHelpers = await import('../utils/helpers.js');
jest.unstable_mockModule('../utils/helpers.js', () => ({
  ...actualHelpers,
  randomHex: mockRandomHex,
}));

const { buildContext } = await import('../context.js');
const { REDACTION_MESSAGE } = await import('../logger.js');

describe('buildContext', () => {
  let loggerMock: Logger;
  let cacheMock: { adapter: { get: jest.Mock; set: jest.Mock; delete: jest.Mock } };
  let tokenMock: JWTAccessToken;
  let dataSourcesMock: {
    sqlDataSource: MySQLConnection;
    dmphubAPIDataSource: DMPHubAPI;
  };

  beforeEach(() => {
    loggerMock = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
      level: 'info',
      silent: jest.fn(),
      child: jest.fn(),
    } as unknown as Logger;
    (loggerMock.child as jest.Mock).mockReturnValue(loggerMock);

    cacheMock = {
      adapter: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
    };
    tokenMock = { token: 'test-token' } as unknown as JWTAccessToken;
    dataSourcesMock = {
      sqlDataSource: {} as MySQLConnection,
      dmphubAPIDataSource: {} as DMPHubAPI,
    };
    mockRandomHex.mockReturnValue('abcdef1234567890abcdef1234567890');

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should return a valid context with provided cache and token', async () => {
    const context = buildContext(
      loggerMock,
      cacheMock.adapter,
      tokenMock,
      dataSourcesMock.sqlDataSource,
      dataSourcesMock.dmphubAPIDataSource,
    );

    expect(context.cache).toEqual(cacheMock.adapter);
    expect(context.requestId).toBeTruthy();
    expect(context.token).toBe(tokenMock);
    expect(context.logger.debug).toBeDefined();
    expect(context.dataSources.dmphubAPIDataSource).toEqual(dataSourcesMock.dmphubAPIDataSource);
    expect(context.dataSources.sqlDataSource).toEqual(dataSourcesMock.sqlDataSource);
    expect(loggerMock.child).toHaveBeenCalled();
  });

  it('should return a valid context with default cache when cache is null', async () => {
    const context = buildContext(
      loggerMock,
      null,
      tokenMock,
      dataSourcesMock.sqlDataSource,
      dataSourcesMock.dmphubAPIDataSource,
    ); // Passing null for cache

    expect(context.cache).toBeTruthy();
    expect(context.requestId).toBeTruthy();
    expect(context.token).toBe(tokenMock);
    expect(context.logger.error).toBeDefined();
    expect(context.dataSources.dmphubAPIDataSource).toEqual(dataSourcesMock.dmphubAPIDataSource);
    expect(context.dataSources.sqlDataSource).toEqual(dataSourcesMock.sqlDataSource);
    expect(context.cache).toEqual({ skipCache: true });
  });

  it('should return a valid context with null token when token is null', async () => {
    const context = buildContext(
      loggerMock,
      cacheMock,
      null,
      dataSourcesMock.sqlDataSource,
      dataSourcesMock.dmphubAPIDataSource,
    ); // Passing null for token

    expect(context.cache).toEqual(cacheMock);
    expect(context.requestId).toBeTruthy();
    expect(context.token).toBe(null);
    expect(context.logger.info).toBeDefined();
    expect(context.dataSources.dmphubAPIDataSource).toEqual(dataSourcesMock.dmphubAPIDataSource);
    expect(context.dataSources.sqlDataSource).toEqual(dataSourcesMock.sqlDataSource);
  });

  it('should log and return null when an error occurs', async () => {
    const err = new Error('testing error');
    // Simulate an error when generating the requestId
    mockRandomHex.mockImplementationOnce(() => {
      throw err;
    });

    const context = buildContext(loggerMock, cacheMock, tokenMock);

    expect(context).toBeNull();

    // Ensure the error is logged with the expected message
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: {},
        logger: loggerMock,
        cache: cacheMock,
        token: REDACTION_MESSAGE,
      }),
      'Unable to buildContext - testing error'
    );
  });

  it('should log to console when logger is null and an error occurs', async () => {
    const originalConsoleLog = console.log;
    console.log = jest.fn();

    // Simulate an error when generating the requestId
    mockRandomHex.mockImplementationOnce(() => {
      throw new Error('testing error');
    });

    const context = buildContext(null, cacheMock, tokenMock); // Passing null for logger

    expect(context).toBeNull();

    // Ensure the error is logged to console when logger is null
    expect(console.log).toHaveBeenCalledWith('Unable to buildContext - testing error');
    console.log = originalConsoleLog;
  });
});
