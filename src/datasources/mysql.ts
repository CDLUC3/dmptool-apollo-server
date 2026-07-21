import * as mysql2 from 'mysql2/promise';
import { mysqlGeneralConfig, mysqlPoolConfig } from "../config/mysqlConfig";
import { logger, prepareObjectForLogs } from '../logger';
import { MyContext } from '../context';

export interface DatabaseConnection {
  getConnection(): Promise<mysql2.PoolConnection>;
  beginTransaction(): Promise<mysql2.PoolConnection>;
  commitTransaction(transaction: mysql2.PoolConnection): Promise<void>;
  query<T>(context: MyContext, sql: string, values?: string[]): Promise<T>;
  close(): Promise<void>;
}

export interface DatabaseTransactionClient {
  connection: mysql2.PoolConnection;
  begin(): Promise<void>;
  rollback(): Promise<void>;
  commit(): Promise<void>;
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
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

export class TransactionClient implements DatabaseTransactionClient {
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
  public initPromise: Promise<void>;

  constructor() {
    logger.info('Establishing MySQL connection pool...');
    try {
      this.pool = mysql2.createPool({
        ...mysqlPoolConfig,
        ...POOL_CONFIG
      });

      // Add initialization check
      this.initPromise = this.validateConnection();

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
  private async validateConnection(): Promise<void> {
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

  public async beginTransaction(): Promise<mysql2.PoolConnection> {
    const connection = await this.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  public async commitTransaction(transaction: mysql2.PoolConnection): Promise<void> {
    await transaction.commit();
  }

  // Query the database
  public async query<T>(context: MyContext, sql: string, values: string[] = []): Promise<T> {
    let connection: mysql2.PoolConnection | null = null;
    try {
      // Wait for initialization to complete before querying
      await this.initPromise;

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
