import * as dotenv from 'dotenv';
import { verifyCriticalEnvVariable } from "../utils/helpers";
import { RedisClientOptions } from "@keyv/redis";

dotenv.config();

verifyCriticalEnvVariable('CACHE_HOST');
verifyCriticalEnvVariable('CACHE_PORT');

// Only use TLS when not running in the local docker env
const isLocal: boolean = ['development', 'test'].includes(process.env.NODE_ENV);

export const cacheConfig: RedisClientOptions = {
  socket: {
    tls: isLocal ? undefined : true,
    host: process.env.CACHE_HOST || 'localhost',
    port: Number.parseInt(process.env.CACHE_PORT || '6379'),
    connectTimeout: Number.parseInt(process.env.CACHE_CONNECT_TIMEOUT) ?? 30000, // 30 seconds
    reconnectStrategy: (times: number) => Math.min(times * 50, 2000),
  }
};
