import { DatabaseError, MySQLConnection, TransactionClient } from '../mysql';
import * as mysql2 from 'mysql2/promise';
import { buildMockContextWithToken } from '../../__mocks__/context.js';
import { MyContext } from '../../context.js';
import { GraphQLError } from 'graphql';
import { logger } from "../../logger.js";

jest.mock('mysql2/promise');
jest.mock('../../context');

describe('MySQLConnection', () => {
  let context: MyContext
  let mockPool: mysql2.Pool;
  let mockConnection: mysql2.PoolConnection;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    // Mock MySQL pool and connection
    mockConnection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(true),
      execute: jest.fn().mockResolvedValue([[{ id: 1, name: 'Test' }], []]),
    } as unknown as mysql2.PoolConnection;

    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      execute: jest.fn().mockResolvedValue([[{ id: 1, name: 'Test' }], []]),
      on: jest.fn(),
      end: jest.fn(),
    } as unknown as mysql2.Pool;

    (mysql2.createPool as jest.Mock).mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should log an error and throw if pool creation fails', async () => {
      jest.spyOn(mysql2, 'createPool').mockImplementationOnce(() => {
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

      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(
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
      const action = jest.fn(async (txClient: TransactionClient) => {
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
      (mockPool.getConnection as jest.Mock).mockRejectedValueOnce(new Error('No connection'));

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
