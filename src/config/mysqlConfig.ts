import * as dotenv from 'dotenv';
import { verifyCriticalEnvVariable } from "../utils/helpers";
import {ConnectionParams} from "@dmptool/utils";
import {Logger} from "pino";

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

if (process.env.NODE_ENV === 'production') {
  verifyCriticalEnvVariable('MYSQL_HOST');
  verifyCriticalEnvVariable('MYSQL_USER');
  verifyCriticalEnvVariable('MYSQL_PASSWORD');
}

export const mysqlGeneralConfig = {
  queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT) || 100,
  connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT) || 60000,
}

export const mysqlPoolConfig = {
  host: isTest ? 'localhost' : process.env.MYSQL_HOST,
  port: isTest ? Number(process.env.MYSQL_TEST_PORT) : Number(process.env.MYSQL_PORT) || 3306,
  database: isTest ? process.env.MYSQL_TEST_DATABASE : process.env.MYSQL_DATABASE || 'dmsp',
  user: isTest ? process.env.MYSQL_TEST_USER : process.env.MYSQL_USER,
  password: isTest ? process.env.MYSQL_TEST_PASSWORD : process.env.MYSQL_PASSWORD,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 5,
};

/**
 * Get the connection parameters for the MySQL database. (needed by @dmptool/utils)
 *
 * @param logger The Pino logger
 * @returns The connection parameters
 */
export const getRDSConnectionParams = (logger: Logger): ConnectionParams => {
  return {
    ...mysqlPoolConfig,
    logger,
  };
};
