/*eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

import { mockAppConfigs } from './mockConfigs.js';

mockAppConfigs();

import type { DMPHubAPI } from '../datasources/dmphubAPI.js';
import type { MySQLConnection } from '../datasources/mysql.js';
import type { Logger } from 'pino';
import type { JWTAccessToken } from '../types/general.js';
import type { KeyvAdapter } from '@apollo/utils.keyvadapter';

const mockRandomHex = jest.fn<(...args: any[]) => string>();
jest.unstable_mockModule('../utils/helpers.js', () => ({
  randomHex: mockRandomHex,
}));
jest.unstable_mockModule('@dmptool/utils', () => ({
  toErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

jest.unstable_mockModule('../datasources/dmphubAPI.js', () => ({
  DMPHubAPI: jest.fn(),
}));
jest.unstable_mockModule('../datasources/EZIDAPI.js', () => ({
  EZIDAPI: jest.fn(),
}));
jest.unstable_mockModule('../datasources/openSearch.js', () => ({
  OpenSearch: jest.fn(),
}));
jest.unstable_mockModule('../datasources/mysql.js', () => ({
  MySQLConnection: jest.fn(),
  TransactionClient: jest.fn(),
}));

const mockChildLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  warn: jest.fn(),
  trace: jest.fn(),
  level: 'info',
  silent: jest.fn(),
  child: jest.fn(),
};
mockChildLogger.child.mockReturnValue(mockChildLogger);
jest.unstable_mockModule('../logger.js', () => ({
  initLogger: jest.fn().mockImplementation((logger: Logger, fields: object) =>
    logger.child(fields),
  ),
  prepareObjectForLogs: jest.fn((object: unknown) => object),
}));

const { buildContext } = await import('../context.js');

describe('buildContext', () => {
  let loggerMock: Logger;
  let cacheMock: KeyvAdapter<string>;
  let tokenMock: JWTAccessToken;
  let dataSourcesMock: {
    sqlDataSource: MySQLConnection;
    dmphubAPIDataSource: DMPHubAPI;
  };

  beforeEach(() => {
    loggerMock = mockChildLogger as unknown as Logger;

    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as KeyvAdapter<string>;
    tokenMock = { token: 'test-token' } as unknown as JWTAccessToken;
    dataSourcesMock = {
      sqlDataSource: {} as MySQLConnection,
      dmphubAPIDataSource: {} as DMPHubAPI,
    };
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockRandomHex.mockReturnValue('abcdef1234567890abcdef1234567890');
  });

  it('should return a valid context with provided cache and token', async () => {
    const context = buildContext(
      loggerMock,
      cacheMock,
      tokenMock,
      dataSourcesMock.sqlDataSource,
      dataSourcesMock.dmphubAPIDataSource,
    );

    expect(context.cache).toEqual(cacheMock);
    expect(context.requestId).toBeTruthy();
    expect(context.token).toBe(tokenMock);
    expect(context.logger.debug).toBeDefined();
    expect(context.dataSources.dmphubAPIDataSource).toEqual(dataSourcesMock.dmphubAPIDataSource);
    expect(context.dataSources.sqlDataSource).toEqual(dataSourcesMock.sqlDataSource);
    expect(loggerMock.child).toHaveBeenCalled();
  });

  it('should return a context with null cache when cache is null', () => {
    const context = buildContext(
      loggerMock,
      null,
      tokenMock,
      dataSourcesMock.sqlDataSource,
      dataSourcesMock.dmphubAPIDataSource,
    ); // Passing null for cache

    expect(context.cache).toBeNull();
    expect(context.requestId).toBeTruthy();
    expect(context.token).toBe(tokenMock);
    expect(context.logger.error).toBeDefined();
    expect(context.dataSources.dmphubAPIDataSource).toEqual(dataSourcesMock.dmphubAPIDataSource);
    expect(context.dataSources.sqlDataSource).toEqual(dataSourcesMock.sqlDataSource);
    expect(context.cache).toBeNull();
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

  it('should log and rethrow when an error occurs', () => {
    const err = new Error('testing error');
    mockRandomHex.mockImplementationOnce(() => {
      throw err;
    });

    expect(() => buildContext(loggerMock, cacheMock, tokenMock)).toThrow(err);

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err,
        logger: loggerMock,
        cache: cacheMock,
        token: tokenMock,
      }),
      'Unable to buildContext - testing error'
    );
  });

  it('should log to console when logger is null and an error occurs', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockRandomHex.mockImplementationOnce(() => {
      throw new Error('testing error');
    });

    expect(() => buildContext(null, cacheMock, tokenMock)).toThrow('testing error');

    expect(consoleLog).toHaveBeenCalledWith('Unable to buildContext - testing error');
    consoleLog.mockRestore();
  });
});
