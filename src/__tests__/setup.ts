import { jest } from '@jest/globals';

// Make jest available as a global so individual test files don't need to import it themselves
(globalThis as typeof globalThis & { jest: typeof jest }).jest = jest;

// Keep dotenv and config validation logs quiet in test output.
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET ?? 'true';
process.env.DOMAIN = process.env.DOMAIN ?? 'localhost:3000';
process.env.APP_NAME = process.env.APP_NAME ?? 'My test app';
process.env.DEFAULT_AFFILIATION_URI =
  process.env.DEFAULT_AFFILIATION_URI ?? 'https://ror.org/1234abcd';
process.env.DMP_ID_SHOULDER = process.env.DMP_ID_SHOULDER ?? '11.22222/C3';
process.env.TOKEN_HASH_SECRET =
  process.env.TOKEN_HASH_SECRET ?? 'testTokenSecret';
process.env.CACHE_HOST = process.env.CACHE_HOST ?? 'localhost';
process.env.CACHE_PORT = process.env.CACHE_PORT ?? '6379';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'testJwtSecret';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'testJwtRefreshSecret';

jest.mock('../logger.js', () => {
  const original = jest.requireActual('../logger.js') as typeof import('../logger.js');

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };

  return {
    ...original, // Keep all original exports
    // Override the actual write functions for the pino logger and its ability to spawn
    logger: {
      ...mockLogger,
      child: jest.fn().mockReturnValue(mockLogger),
    }
  };
});

// Always mock out our config files
jest.mock('../config/awsConfig.js', () => ({
  awsConfig: {
    region: 'us-west-2',
    ses: {
      endpoint: 'ses@example.com',
      port: 465,
      accessKey: '12345',
      accessSecret: '98765',
      bounceAddress: 'bounce@example.com',
      bouncedEmailBucket: 'my-test-bucket',
    },
    s3: {
      bucket: 'test-bucket',
      localstackPort: '4566'
    },
    dynamo: {
      region: 'us-west-2',
      tableName: 'test-table',
      endpoint: 'http://localhost:8000',
      maxAttempts: 3,
    },
    opensearch: {
      host: 'localhost',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: 'aws',
      username: 'admin',
      password: 'password',
      awsRegion: 'us-west-2',
      awsService: 'es',
    },
    opensearchServerless: {
      node: 'https://test.aoss.example.com:9200',
    }
  },
  getDynamoConnectionParams: jest.fn().mockReturnValue({
    region: 'us-west-2',
    tableName: 'test-table',
    endpoint: 'http://localhost:8000',
    maxAttempts: 3,
  }),
}));

jest.mock('../config/cacheConfig.js', () => ({
  cacheConfig: {
    socket: {
      host: 'localhost',
      port: 6379,
      connectTimeout: 10000,
      reconnectStrategy: jest.fn(),
    }
  },
}));

jest.mock('../config/emailConfig.js', () => ({
  emailConfig: {
    helpDeskAddress: 'help@example.com',
    doNotReplyAddress: 'do-not-reply@example.com'
  }
}));

jest.mock('../config/dmpHubConfig.js', () => ({
  DMPHubConfig: {
    dmpHubAuthURL: 'http://auth.dmphub.example.com',
    dmpHubURL: 'http://api.dmphub.example.com',
    dmpHubClientId: '1234567890',
    dmpHubClientSecret: '0987654321',
    dmpHubCacheTTL: 3000,
    dmpHubProvenance: 'testing',
  }
}));

jest.mock('../config/orcidConfig.js', () => ({
  OrcidConfig: {
    clientId: "DUMMY_CLIENT_ID",
    clientSecret: "DUMMY_CLIENT_SECRET",
    baseApiUrl: "http://pub.sandbox.orcid.org/",
    baseAuthUrl: "http://sandbox.orcid.org/",
    authPath: "/oauth/token",
    apiPath: "/v3.0/",
    readOnlyScope: "/read-public",
  }
}));

jest.mock('../config/generalConfig.js', () => ({
  generalConfig: {
    env: 'test',
    domain: 'localhost:3000',
    applicationName: 'My test app',
    defaultAffiliatioURI: 'https://ror.org/1234abcd',
    defaultSearchLimit: 5,
    maximumSearchLimit: 10,

    dmpIdBaseURL: 'http://dmsp.com/',
    dmpIdShoulder: '11.22222/C3',

    versionPlanAfter: 1,

    orcidBaseURL: 'http://sandbox.orcid.org/',
    rorBaseURL: 'http://ror.example.com/',

    jwtSecret: 'testJwtSecret',
    jwtTTL: 30,
    jwtRefreshSecret: 'testJwtRefreshSecret',
    jwtRefreshTTL: 500,
    hashTokenSecret: 'testTokenSecret',
  },
  envAsEnumValue: () => 'dev'
}));
