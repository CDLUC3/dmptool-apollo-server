jest.mock('../datasources/mysql', () => {
  return {
    __esModule: true,
    MySQLConnection: jest.fn().mockImplementation(() => ({
      pool: null,
      validateConnection: jest.fn(),
      getConnection: jest.fn(),
      releaseConnection: jest.fn(),
      query: jest.fn(),
      withTransaction: jest.fn(),
      close: jest.fn()
    }))
  };
});

jest.mock('../datasources/EZIDAPI', () => {
  return {
    __esModule: true,
    EZIDAPI: jest.fn().mockImplementation(() => ({
      registerIdentifier: jest.fn(),
      willSendRequest: jest.fn(),
      baseURL: '',
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    })),
  };
});

jest.mock('../datasources/openSearch', () => {
  return {
    __esModule: true,
    OpenSearch: jest.fn().mockImplementation(() => ({
      listIndices: jest.fn(),
      findOrInitializeIndex: jest.fn(),
      updateIndexItem: jest.fn(),
      removeIndexItem: jest.fn(),
      search: jest.fn(),

    }))
  }
});

jest.mock('../datasources/dmphubAPI', () => {
  return {
    __esModule: true,
    Authorizer: jest.fn().mockImplementation(() => ({
      authenticate: jest.fn(),
      hasExpired: jest.fn(),
    })),
    DMPHubAPI: jest.fn().mockImplementation(() => ({
      getDMP: jest.fn(),
      createDMP: jest.fn(),
      updateDMP: jest.fn(),
      validateDMP: jest.fn(),
      tombstoneDMP: jest.fn(),
      getAwards: jest.fn(),
      handleResponse: jest.fn(),
      willSendRequest: jest.fn(),
      baseURL: '',
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      authorizer: jest.fn().mockImplementation(() => ({
        authenticate: jest.fn(),
        hasExpired: jest.fn(),
      }))(),
    })),
  };
});

import casual from "casual";
import { Logger } from "pino";
import { JWTAccessToken } from "../services/tokenService.js";
import { MyContext } from "../context.js";
import { DMPHubAPI } from "../datasources/dmphubAPI.js";
import { EZIDAPI } from "../datasources/EZIDAPI.js";
import { MySQLConnection } from "../datasources/mysql.js";
import { OpenSearch } from "../datasources/openSearch.js";
import { User, UserRole } from "../models/User.js";
import { defaultLanguageId } from "../models/Language.js";
import { awsConfig } from "../config/awsConfig.js";

// Mock Cache for testing, just has a local storage hash
let mockCacheStore: Record<string, string> = {};
// eslint-disable-next-line  @typescript-eslint/no-extraneous-class
export class MockCache {
  public static getInstance() {
    return {
      adapter: {
        async set(key: string, val: string): Promise<void> {
          mockCacheStore[key] = val;
        },
        async get(key: string): Promise<string> {
          return mockCacheStore[key];
        },
        async delete(key: string): Promise<void> {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete mockCacheStore[key];
        },
      },
      getStore() {
        return mockCacheStore
      },
      resetStore(): void {
        mockCacheStore = {};
      },
    }
  }
}

// Lazy instantiate to allow mocks to be set up first
let cachedMysqlInstance: jest.Mocked<MySQLConnection> | null = null;
const getMockedMysqlInstance = () => {
  if (!cachedMysqlInstance) {
    // The mock is already instantiated, so just return it
    const mockModule = jest.requireMock('../datasources/mysql');
    // Handle both callable constructor and getInstance pattern
    if (typeof mockModule.MySQLConnection === 'function') {
      cachedMysqlInstance = mockModule.MySQLConnection() as jest.Mocked<MySQLConnection>;
    } else if (mockModule.MySQLConnection.getInstance) {
      cachedMysqlInstance = mockModule.MySQLConnection.getInstance() as jest.Mocked<MySQLConnection>;
    } else {
      cachedMysqlInstance = mockModule.MySQLConnection as jest.Mocked<MySQLConnection>;
    }
  }
  return cachedMysqlInstance;
};

export const mockedMysqlInstance = new Proxy({}, {
  get() {
    return getMockedMysqlInstance();
  }
});

// Generate a mock user
export const mockUser = (
  id = casual.integer(1, 9999),
  givenName = casual.first_name,
  surName = casual.last_name,
  affiliationId = casual.url,
  userRole = UserRole.RESEARCHER,
): User => {
  const user = new User({ id, givenName, surName, affiliationId, role: userRole });
  // Mock getEmail to avoid real DB calls
  user.getEmail = jest.fn().mockResolvedValue(casual.email);
  user.register = jest.fn()
  return user;
  // return new User({ id, givenName, surName, affiliationId, role: userRole });
}

// Generate a mock JWToken
export const mockToken = async (
  user: User = mockUser(),
  context?: MyContext,
): Promise<JWTAccessToken> => {
  const email = await user.getEmail(context);
  return {
    id: user.id,
    email,
    givenName: user.givenName,
    surName: user.surName,
    affiliationId: user.affiliationId,
    role: user.role,
    languageId: defaultLanguageId,
    jti: casual.integer(1, 999999).toString(),
    expiresIn: casual.integer(1, 999999999),
    tokenVersion: 1,
  }
}

export const mockResearcherToken = async (): Promise<JWTAccessToken> => {
  const token = await mockToken();
  return { ...token, role: UserRole.RESEARCHER };
}
export const mockAdminToken = async (): Promise<JWTAccessToken> => {
  const token = await mockToken();
  return { ...token, role: UserRole.ADMIN };
}
export const mockSuperAdminToken = async (): Promise<JWTAccessToken> => {
  const token = await mockToken();
  return { ...token, role: UserRole.SUPERADMIN };
}

// Lazy create mockDataSources to allow mocks to be set up first
interface MockDataSources {
  dmphubAPIDataSource: DMPHubAPI;
  ezidAPIDataSource: EZIDAPI;
  sqlDataSource: jest.Mocked<MySQLConnection>;
  openSearchServerlessDataSource: OpenSearch;
}
let cachedDataSources: MockDataSources | null = null;
export const getMockDataSources = () => {
  if (!cachedDataSources) {
    cachedDataSources = {
      dmphubAPIDataSource: new DMPHubAPI({ cache: null, token: null }),
      ezidAPIDataSource: new EZIDAPI({ cache: null }),
      sqlDataSource: getMockedMysqlInstance(),
      openSearchServerlessDataSource: new OpenSearch(awsConfig.opensearchServerless),
    };
  }
  return cachedDataSources;
};

// Backward compatibility
export const mockDataSources = new Proxy({}, {
  get(target, prop) {
    return getMockDataSources()[prop];
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildContext(logger: Logger, token: JWTAccessToken = null, cache: any = null): MyContext {
  return {
    cache: cache,
    token: token,
    logger: logger,
    requestId: casual.rgb_hex,
    dataSources: getMockDataSources(),
  }
}

// disabling the any since it's the same as above and I think whoever wrote this wanted to avoid the type error
export const buildMockContextWithToken = async (
  logger: Logger,
  user: User = mockUser(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cache: any = null,
): Promise<MyContext> => {
  // Only spy on the prototype if user.getEmail is not defined
  if (!user.getEmail && !jest.isMockFunction(User.prototype.getEmail)) {
    jest.spyOn(User.prototype, 'getEmail').mockImplementation(async () => casual.email);
  }
  const context = buildContext(logger, null, cache);
  const token = await mockToken(user, context);
  context.token = token;
  return context;
};
