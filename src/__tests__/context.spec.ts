import { buildContext } from '../context';
import { DMPHubAPI } from '../datasources/dmphubAPI';
import { MockCache, mockDataSources } from '../__mocks__/context';
// For some reason esLint is reporting this isn't used, but it used below
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { randomHex } from '../utils/helpers';
import { MySQLConnection } from "../datasources/mysql";
import { logger, REDACTION_MESSAGE } from '../logger';

// Mock dependencies
jest.mock('../datasources/dmphubAPI');
jest.mock('../datasources/mysql');

describe('buildContext', () => {
  let loggerMock;
  let cacheMock;
  let tokenMock;
  let dataSourcesMock: { sqlDataSource: MySQLConnection, dmphubAPIDataSource: DMPHubAPI };

  beforeEach(() => {
    loggerMock = logger;
    cacheMock = MockCache.getInstance();
    tokenMock = { accessToken: 'test-token' };
    dataSourcesMock = mockDataSources

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
    const mockRandomHex = jest.fn().mockImplementationOnce(() => {
      throw err;
    });
    (randomHex as jest.Mock) = mockRandomHex;

    const context = buildContext(loggerMock, cacheMock, tokenMock);

    expect(context).toBeNull();

    // Ensure the error is logged with the expected message
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        err: {},
        logger: loggerMock,
        cache: cacheMock,
        token: REDACTION_MESSAGE,
      },
      'Unable to buildContext - testing error'
    );
  });

  it('should log to console when logger is null and an error occurs', async () => {
    console.log = jest.fn(); // Mock console.log

    // Simulate an error when generating the requestId
    const mockRandomHex = jest.fn().mockImplementationOnce(() => {
      throw new Error('testing error');
    });
    (randomHex as jest.Mock) = mockRandomHex;

    const context = buildContext(null, cacheMock, tokenMock); // Passing null for logger

    expect(context).toBeNull();

    // Ensure the error is logged to console when logger is null
    expect(console.log).toHaveBeenCalledWith('Unable to buildContext - testing error');
  });
});
