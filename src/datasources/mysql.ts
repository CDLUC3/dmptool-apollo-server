import * as mysql2 from 'mysql2/promise';
import { mysqlGeneralConfig, mysqlPoolConfig } from "../config/mysqlConfig";
import { logger, prepareObjectForLogs } from '../logger';
import { MyContext } from '../context';
import { toErrorMessage } from "@dmptool/utils";
import {GraphQLError} from "graphql";

export interface DatabaseConnection {
  getConnection(): Promise<mysql2.PoolConnection>;
  query<T>(context: MyContext, sql: string, values?: string[]): Promise<T>;
  close(): Promise<void>;
  withTransaction<T>(
    context: MyContext,
    action: (txClient: TransactionClient) => Promise<T>
  ): Promise<T>;
}

/**
 * A database error
 */
export class DatabaseError extends Error {
  public readonly code?: string;

  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'DatabaseError';
    if (originalError && typeof originalError === 'object' && 'code' in originalError) {
      this.code = (originalError as { code: string }).code;
    }
  }
}

const POOL_CONFIG = {
  waitForConnections: true,
  multipleStatements: false,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: mysqlGeneralConfig.connectTimeout,
  queueLimit: mysqlGeneralConfig.queueLimit
};

export class TransactionClient {
  public connection: mysql2.PoolConnection;

  constructor(connection: mysql2.PoolConnection) {
    this.connection = connection;
  }

  async begin(): Promise<void> {
    await this.connection.beginTransaction();
  }
  async rollback(): Promise<void> {
    await this.connection.rollback();
  }
  async commit(): Promise<void> {
    await this.connection.commit();
  }
}

export class MySQLConnection implements DatabaseConnection {
  private pool: mysql2.Pool;

  constructor() {
    logger.info('Establishing MySQL connection pool...');
    try {
      this.pool = mysql2.createPool({
        ...mysqlPoolConfig,
        ...POOL_CONFIG
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this.pool.on('connection', (_connection) => {
        logger.trace('Connection established');
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this.pool.on('release', (_connection) => {
        logger.trace('Connection released');
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this.pool.on('acquire', (_connection) => {
        logger.trace('Connection acquired');
      });
    } catch (err) {
      logger.error('Unable to establish the MySQL connection pool');
      throw new DatabaseError('Failed to create connection pool', err);
    }
  }

  // Verify that the pool is able to establish a connection
  public async validateConnection(): Promise<void> {
    const connection = await this.getConnection();
    connection.release();
  }

  // Get a new connection
  public async getConnection(): Promise<mysql2.PoolConnection> {
    try {
      return await this.pool.getConnection();
    } catch (err) {
      logger.error('Failed to get connection from pool');
      throw new DatabaseError('Failed to get connection from pool', err);
    }
  }

  public async releaseConnection(connection: mysql2.PoolConnection): Promise<void> {
    try {
      connection.release();
    } catch (err) {
      logger.error('Failed to release connection');
      throw new DatabaseError('Failed to release connection', err);
    }
  }

  // Query the database
  public async query<T>(context: MyContext, sql: string, values: string[] = []): Promise<T> {
    let connection: mysql2.PoolConnection | null = null;
    try {
      connection = await this.getConnection();
      const sanitizedValues = values.map(val =>
        typeof val === 'string' ? val.trim() : val
      );

      const [rows] = await connection.execute(sql, sanitizedValues);
      return rows as T;
    } catch (err) {
      context.logger.error(prepareObjectForLogs({ sql, values, err }), 'Unable to process SQL query');
      throw new DatabaseError('Database query failed', err);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Runs a callback within a managed transaction.
   * Auto-commits on success, auto-rollbacks on error, and ensures release.
   */
  public async withTransaction<T>(
    context: MyContext,
    action: (txClient: TransactionClient) => Promise<T>
  ): Promise<T> {
    let connection: mysql2.PoolConnection;
    try {
      connection = await this.getConnection();
    } catch (error) {
      throw new DatabaseError('Failed to get connection for transaction', error);
    }
    const txClient = new TransactionClient(connection);
    let result: Awaited<T>;

    try {
      context.logger.debug('Starting database transaction');
      await txClient.begin();
      // Store current transaction in context for nested calls if needed
      context.activeTransaction = txClient;

      result = await action(txClient);

      context.logger.debug('Committing database transaction');
      await txClient.commit();
      return result;

    } catch (err) {
      context.logger.error(
        prepareObjectForLogs({ err: toErrorMessage(err) }),
        'Rolling back transaction'
      );
      // Always rollback!
      await txClient.rollback();

      // In scenarios where we encountered a standard GraphQL error that was
      // a Bad Request, we just want to return the object because it contains
      // contextual errors.
      if (err instanceof GraphQLError && err.extensions?.code === 'BAD_REQUEST_ERROR_CODE') {
        return result;
      }
      throw err;

    } finally {
      // Clear transaction context & release connection
      context.logger.debug('Releasing database connection');
      context.activeTransaction = undefined;
      connection.release();
    }
  }

  // Shutdown the pool
  public async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (err) {
        logger.error('Unable to close the MySQL connection pool');
        throw new DatabaseError('Failed to close connection pool', err);
      }
    }
  }
}
