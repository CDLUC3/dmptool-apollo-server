import { MySQLConnection } from './mysql';
import { Cache } from './cache';
import { DMPHubAPI } from './dmphubAPI';
import { EZIDAPI } from './EZIDAPI';

export const cache = Cache.getInstance().adapter;
export const sqlDataSource = new MySQLConnection();
export const dmphubAPIDataSource = new DMPHubAPI({ cache, token: null });
export const ezidAPIDataSource = new EZIDAPI({ cache });