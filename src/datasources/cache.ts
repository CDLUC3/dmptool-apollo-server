import Keyv from "keyv";
import KeyvRedis from "@keyv/redis";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { cacheConfig } from "../config/cacheConfig";
import { logger } from '../logger';

// Note that Redis cache clusters require you to wrap keys in `{}` to ensure that they are stored
// near one another and are able to be set and fetched.
//    For example: `{csrf}:12345` instead of `csrf:12345`
export class Cache {
  private static instance: Cache | undefined;

  public readonly adapter: KeyvAdapter;

  private constructor() {
    logger.info(cacheConfig, 'Attempting to connect to Redis');

    const keyv = new Keyv({
      store: new KeyvRedis(
        cacheConfig,
        {
          throwOnConnectError: true
        }
      )
    });

    keyv.on('connect', () => {
      logger.info({}, `Redis connection established`);
    });

    keyv.on('error', (err) => {
      logger.error(err, `Redis connection error - ${err.message}`);
    });

    keyv.on('close', () => {
      logger.info( {}, `Redis connection closed`);
    });

    // Set the Adapter which will be used to interact with the cache
    this.adapter = new KeyvAdapter(
      // Using any here because the KeyvRedis adapter does not export the correct type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keyv as any,
      { disableBatchReads: true }
    );
  }

  // Singleton instance of the Cache
  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  // Remove the instance
  public static async destroy(): Promise<void> {
    Cache.instance = undefined;
  }
}
