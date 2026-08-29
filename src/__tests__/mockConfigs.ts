import { jest } from '@jest/globals';

/**
 * Registers jest.unstable_mockModule() calls for all shared config files.
 * Must be called at the top of a test file, BEFORE any dynamic `await import(...)`
 * of app modules that depend on these configs (directly or transitively).
 */
export function mockAppConfigs() {
  jest.unstable_mockModule('../config/awsConfig.js', () => ({
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
        localstackPort: '4566',
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
      },
    },
    getDynamoConnectionParams: jest.fn().mockReturnValue({
      region: 'us-west-2',
      tableName: 'test-table',
      endpoint: 'http://localhost:8000',
      maxAttempts: 3,
    }),
  }));

  jest.unstable_mockModule('../config/cacheConfig.js', () => ({
    cacheConfig: {
      socket: {
        host: 'localhost',
        port: 6379,
        connectTimeout: 10000,
        reconnectStrategy: jest.fn(),
      },
    },
  }));

  jest.unstable_mockModule('../config/emailConfig.js', () => ({
    emailConfig: {
      helpDeskAddress: 'help@example.com',
      doNotReplyAddress: 'do-not-reply@example.com',
    },
  }));

  jest.unstable_mockModule('../config/dmpHubConfig.js', () => ({
    DMPHubConfig: {
      dmpHubAuthURL: 'http://auth.dmphub.example.com',
      dmpHubURL: 'http://api.dmphub.example.com',
      dmpHubClientId: '1234567890',
      dmpHubClientSecret: '0987654321',
      dmpHubCacheTTL: 3000,
      dmpHubProvenance: 'testing',
    },
  }));

  jest.unstable_mockModule('../config/orcidConfig.js', () => ({
    OrcidConfig: {
      clientId: 'DUMMY_CLIENT_ID',
      clientSecret: 'DUMMY_CLIENT_SECRET',
      baseApiUrl: 'http://pub.sandbox.orcid.org/',
      baseAuthUrl: 'http://sandbox.orcid.org/',
      authPath: '/oauth/token',
      apiPath: '/v3.0/',
      readOnlyScope: '/read-public',
    },
  }));

  jest.unstable_mockModule('../config/generalConfig.js', () => ({
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
    envAsEnumValue: () => 'dev',
  }));
}

/**
 * Registers a jest.unstable_mockModule() for the logger.
 * Kept separate since some tests want the real logger's shape but mocked write methods.
 */
export function mockAppLogger() {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(),
  };

  mockLogger.child.mockReturnValue(mockLogger);

  jest.unstable_mockModule('../logger.js', () => ({
    logger: mockLogger,
    prepareObjectForLogs: (obj: unknown) => obj,
    initLogger: jest.fn().mockReturnValue(mockLogger),
  }));
}

/**
 * Registers a jest.unstable_mockModule() for the User model.
 * `User` is mocked as a jest.fn() constructor (not a real class) so that
 * tests can control what `new User(...)` returns via `.mockImplementation()`.
 * Static methods used across the codebase/tests are stubbed as jest.fn().
 * UserRole/LogInType are hardcoded here since we can't import the real
 * enums without pulling in the real (unmocked) User.js module.
 */
export function mockUserModel() {
  jest.unstable_mockModule('../models/User.js', () => {
    const UserRole = {
      RESEARCHER: 'RESEARCHER',
      ADMIN: 'ADMIN',
      SUPERADMIN: 'SUPERADMIN',
    };

    const LogInType = {
      PASSWORD: 'PASSWORD',
      SSO: 'SSO',
    };

    const MockUser = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).findById = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).findByOrcid = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).findByEmail = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).authCheck = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).findByAffiliationId = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).search = jest.fn();
    (MockUser as unknown as Record<string, jest.Mock>).getDefaultPaginationOptions = jest.fn().mockReturnValue({});

    return {
      User: MockUser,
      UserRole,
      LogInType,
    };
  });
}