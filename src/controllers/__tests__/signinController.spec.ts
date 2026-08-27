import { jest } from '@jest/globals';
import casual from 'casual';
import { Request, Response } from 'express';

import { mockAppConfigs, mockAppLogger, mockUserModel } from '../../__tests__/mockConfigs.js';

// Register config + logger + User mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();
mockUserModel();

// Mock external dependencies
jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

jest.unstable_mockModule('../../datasources/cache.js', () => ({
  Cache: {
    getInstance: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/tokenService.js', () => ({
  generateAuthTokens: jest.fn<() => Promise<{ accessToken?: string; refreshToken?: string }>>(),
  setTokenCookie: jest.fn(),
}));

// Dynamic imports AFTER all mocks are registered
const { Cache } = await import('../../datasources/cache.js');
const { generateAuthTokens, setTokenCookie } = await import('../../services/tokenService.js');
const { generalConfig } = await import('../../config/generalConfig.js');
const { signinController } = await import('../signinController.js');
const UserModel = await import('../../models/User.js');
const { defaultLanguageId } = await import('../../models/Language.js');
const { getRandomEnumValue } = await import('../../__tests__/helpers.js');
const { getCurrentDate } = await import('../../utils/helpers.js');
const { buildContext } = await import('../../context.js');
const { logger } = await import('../../logger.js');

const mockedUser: InstanceType<typeof UserModel.User> = {
  id: casual.integer(1, 999),
  getEmail: jest.fn<() => Promise<string>>().mockResolvedValue(casual.email),
  givenName: casual.first_name,
  surName: casual.last_name,
  affiliationId: casual.url,
  role: UserModel.UserRole.RESEARCHER,
  password: casual.uuid,
  acceptedTerms: true,
  languageId: defaultLanguageId,
  orcid: casual.url,
  ssoId: casual.uuid,
  locked: false,
  active: true,
  notify_on_comment_added: casual.boolean,
  notify_on_template_shared: casual.boolean,
  notify_on_feedback_complete: casual.boolean,
  notify_on_plan_shared: casual.boolean,
  notify_on_plan_visibility_change: casual.boolean,
  last_sign_in: getCurrentDate(),
  last_sign_in_via: getRandomEnumValue(UserModel.LogInType),
  failed_sign_in_attempts: 0,
  created: new Date().toISOString(),
  tableName: 'testUsers',
  errors: {},

  getName: jest.fn(),
  recordLogIn: jest.fn(),
  isValid: jest.fn(),
  validatePassword: jest.fn(),
  hashPassword: jest.fn(),
  setPassword: jest.fn(),
  prepForSave: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  addError: jest.fn(),
  hasErrors: jest.fn(),
  errorsToString: jest.fn(),
} as unknown as InstanceType<typeof UserModel.User>;

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

describe('signinController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;
  let mockCache;
  let mockUser: InstanceType<typeof UserModel.User>;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Re-apply mock implementations AFTER resetAllMocks, since resetAllMocks
    // strips implementations set at factory time.
    jest.mocked(buildContext).mockReturnValue({
      logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
        trace: jest.fn(),
      },
      cache: null,
      token: null,
      requestId: 'test-request-id',
      dataSources: {},
    } as never);

    mockRequest = {
      body: {
        email: casual.email,
        password: casual.uuid,
      },
      logger: logger,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockCache = Cache.getInstance();
    jest.mocked(Cache.getInstance).mockReturnValue(mockCache);

    mockUser = mockedUser;
    (UserModel.User as unknown as jest.Mock).mockImplementation(() => mockUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should sign the user in and set the access and refresh tokens successfully', async () => {
    jest.mocked(mockUser.login).mockResolvedValueOnce(mockedUser);
    jest.mocked(generateAuthTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    await signinController(mockRequest as Request, mockResponse as unknown as Response);

    expect(generateAuthTokens).toHaveBeenCalled();
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspt', 'new-access-token', generalConfig.jwtTTL);
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspr', 'new-refresh-token', generalConfig.jwtRefreshTTL);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: 'ok' });
  });

  it('should return 401 if user login fails', async () => {
    jest.mocked(mockUser.login).mockResolvedValueOnce(null);

    await signinController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Invalid credentials' });
  });

  it('should return 500 if unable to generate tokens', async () => {
    jest.mocked(mockUser.login).mockResolvedValueOnce(mockedUser);
    jest.mocked(generateAuthTokens).mockResolvedValue({ accessToken: undefined, refreshToken: undefined });

    await signinController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Unable to sign in at this time' });
  });

  it('should return 500 if an unexpected error occurs', async () => {
    jest.mocked(mockUser.login).mockResolvedValueOnce(mockedUser);
    const mockError = new Error('Unexpected error');
    jest.mocked(generateAuthTokens).mockRejectedValue(mockError);

    await signinController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
  });
});