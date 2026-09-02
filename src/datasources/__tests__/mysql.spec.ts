/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';
import { GraphQLError } from 'graphql';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// mysql2/promise: only imported for TYPES below (mysql2.Pool,
// mysql2.PoolConnection, mysql2.QueryResult) — never for its runtime value.
// A real (non-type) `import * as mysql2 from 'mysql2/promise'` here would be
// hoisted and fully evaluated before jest.unstable_mockModule ever
// registers, giving the test its own separate, unmocked mysql2 reference —
// completely disconnected from what mysql.js (dynamically imported below)
// actually resolves the specifier to. Every runtime interaction with
// createPool goes through the named mockMySQL2 mock directly instead.
// ---------------------------------------------------------------------------
import type * as mysql2 from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { MyContext } from '../../context.js';
import type { TransactionClient as TransactionClientType } from '../mysql.js';

const mockMySQL2 = jest.fn<(...args: any[]) => any>();
const actualMySQL2 = await import('mysql2/promise');
jest.unstable_mockModule('mysql2/promise', () => ({
  ...actualMySQL2,
  createPool: mockMySQL2,
}));

interface MockRow extends RowDataPacket {
  id: number;
  name: string;
}

const { logger } = await import('../../logger.js');
const { DatabaseError, MySQLConnection } = await import('../mysql.js');

// ---------------------------------------------------------------------------
// Context is built locally rather than via `__mocks__/context.js`'s
// `buildMockContextWithToken` — that shared helper itself calls
// jest.unstable_mockModule('../datasources/mysql.js', ...), which would
// replace the real MySQLConnection (the very class under test here) with a
// stub before this file's own dynamic import of it ever runs.
// ---------------------------------------------------------------------------
const buildTestContext = (): MyContext => ({
  cache: {} as unknown as MyContext['cache'],
  token: null,
  logger,
  requestId: 'test-request-id',
  dataSources: {} as unknown as MyContext['dataSources'],
});

describe('MySQLConnection', () => {
  let context: MyContext
  let mockPool: mysql2.Pool;
  let mockConnection: mysql2.PoolConnection;
  let mockExecute: jest.Mock<(...args: any[]) => Promise<mysql2.QueryResult>>;
  let mockGetConnection: jest.Mock<() => Promise<mysql2.PoolConnection>>;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = buildTestContext();
    const queryRows: MockRow[] = [{ id: 1, name: 'Test' } as MockRow];
    const queryResult: [MockRow[], ResultSetHeader] = [
      queryRows,
      {} as ResultSetHeader,
    ];
    mockExecute = jest.fn<(...args: any[]) => Promise<mysql2.QueryResult>>()
      .mockResolvedValue(queryResult);
    mockGetConnection = jest
      .fn<() => Promise<mysql2.PoolConnection>>();

    // Mock MySQL pool and connection
    mockConnection = {
      beginTransaction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      commit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      rollback: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      release: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      execute: mockExecute,
    } as unknown as mysql2.PoolConnection;
    mockGetConnection.mockResolvedValue(mockConnection);

    mockPool = {
      getConnection: mockGetConnection,
      execute: mockExecute,
      on: jest.fn(),
      end: jest.fn(),
    } as unknown as mysql2.Pool;

    mockMySQL2.mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should log an error and throw if pool creation fails', async () => {
      mockMySQL2.mockImplementationOnce(() => {
        throw new Error('Failed to create pool');
      });
      jest.spyOn(logger, 'error');

      expect(() => new MySQLConnection()).toThrow('Failed to create connection pool');
      expect(logger.error).toHaveBeenCalledWith('Unable to establish the MySQL connection pool');
    });
  });

  describe('getConnection', () => {
    it('should retrieve a connection from the pool', async () => {
      const sqlDataSource = new MySQLConnection();
      await sqlDataSource.validateConnection();
      const connection = await sqlDataSource.getConnection();

      expect(connection).toBe(mockConnection);
      expect(mockPool.getConnection).toHaveBeenCalled();
      await sqlDataSource.close();
    });
  });

  describe('releaseConnection', () => {
    it('should release the connection', async () => {
      const sqlDataSource = new MySQLConnection();
      await sqlDataSource.validateConnection();
      const connection = await sqlDataSource.getConnection();
      await sqlDataSource.releaseConnection(connection);

      expect(mockConnection.release).toHaveBeenCalled();
      await sqlDataSource.close();
    });
  });

  describe('query', () => {
    it('should execute a SQL query and return rows', async () => {
      const sqlDataSource = new MySQLConnection();
      await sqlDataSource.validateConnection();
      const sql = 'SELECT * FROM users WHERE id = ?';
      const values = [' 1 ']; // Simulate a value that needs trimming

      const result = await sqlDataSource.query(context, sql, values);

      expect(mockConnection.execute).toHaveBeenCalledWith(sql, ['1']); // Trimmed value
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
      await sqlDataSource.close();
    });

    it('should log an error and throw if query execution fails', async () => {
      const sqlDataSource = new MySQLConnection();
      await sqlDataSource.validateConnection();
      const sql = 'SELECT * FROM users WHERE id = ?';
      const values = ['1'];

      mockExecute.mockRejectedValueOnce(
        new Error('Testing query failure - this is ok. We expect to see this in the test output!')
      );
      jest.spyOn(console, 'log');

      await expect(sqlDataSource.query(context, sql, values)).rejects.toThrow('Database query failed');
      expect(context.logger.error).toHaveBeenCalled();
      await sqlDataSource.close();
    });
  });

  describe('withTransaction', () => {
    it('should begin, commit, and release the connection when the action succeeds', async () => {
      const sqlDataSource = new MySQLConnection();
      const expected = { id: 1, name: 'Test' };
      const action = jest.fn(async (txClient: TransactionClientType) => {
        expect(context.activeTransaction).toBe(txClient);
        expect(txClient.connection).toBe(mockConnection);
        return expected;
      });

      const result = await sqlDataSource.withTransaction(context, action);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
      expect(context.activeTransaction).toBeUndefined();
      expect(result).toEqual(expected);
      await sqlDataSource.close();
    });

    it('should rollback, release the connection, and rethrow when the action fails', async () => {
      const sqlDataSource = new MySQLConnection();
      const err = new Error('Transaction failed');
      const action = jest.fn(async () => {
        throw err;
      });

      await expect(sqlDataSource.withTransaction(context, action)).rejects.toThrow(err);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
      expect(context.activeTransaction).toBeUndefined();
      await sqlDataSource.close();
    });

    it('should rollback and rethrow GraphQL errors', async () => {
      const sqlDataSource = new MySQLConnection();
      const err = new GraphQLError('Validation failed', {
        extensions: { code: 'BAD_REQUEST_ERROR_CODE' }
      });
      const action = jest.fn(async () => {
        throw err;
      });

      await expect(sqlDataSource.withTransaction(context, action)).rejects.toThrow(err);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
      expect(context.activeTransaction).toBeUndefined();
      await sqlDataSource.close();
    });

    it('should wrap connection acquisition failures in a DatabaseError', async () => {
      const sqlDataSource = new MySQLConnection();
      mockGetConnection.mockRejectedValueOnce(new Error('No connection'));

      await expect(
        sqlDataSource.withTransaction(context, async () => 'should not run')
      ).rejects.toThrow(new DatabaseError('Failed to get connection for transaction'));

      expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      await sqlDataSource.close();
    });
  });

  describe('close', () => {
    it('should close the MySQL connection pool', async () => {
      const sqlDataSource = new MySQLConnection();
      await sqlDataSource.validateConnection();
      await sqlDataSource.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});