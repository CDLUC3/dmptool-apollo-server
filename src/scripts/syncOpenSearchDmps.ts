import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import Keyv from 'keyv';
import { pathToFileURL } from 'node:url';
import { awsConfig } from '../config/awsConfig.js';
import { buildContext } from '../context.js';
import { MySQLConnection } from '../datasources/mysql.js';
import { OpenSearch } from '../datasources/openSearch.js';
import { logger } from '../logger.js';
import { OpenSearchDMPSync } from '../models/DataSyncJob.js';

export async function runOpenSearchDmpSync(): Promise<void> {
  const sqlDataSource = new MySQLConnection();

  try {
    await sqlDataSource.validateConnection();

    const context = buildContext(
      logger,
      // Keyv exposes incompatible private fields across the installed packages.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new KeyvAdapter(new Keyv() as any),
      null,
      sqlDataSource,
      null,
      null,
      new OpenSearch(awsConfig.opensearchServerless),
    );

    await new OpenSearchDMPSync().start('cli-open-search-dmp-sync', context);
  } finally {
    await sqlDataSource.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runOpenSearchDmpSync().catch((error: unknown) => {
    logger.error({ error }, 'OpenSearch DMP synchronization failed');
    process.exitCode = 1;
  });
}
