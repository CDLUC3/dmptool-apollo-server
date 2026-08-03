import casual from 'casual';
import { Request, Response } from 'express';
import { Cache } from "../../datasources/cache";
import { generateAuthTokens, setTokenCookie } from '../../services/tokenService';
import { generalConfig } from '../../config/generalConfig';
import { signinController } from '../signinController';
import * as UserModel from '../../models/User';
import { defaultLanguageId } from '../../models/Language';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { getCurrentDate } from '../../utils/helpers';
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock('../../context.ts');

// Mocking external dependencies
jest.mock('../../datasources/cache');
jest.mock('../../services/tokenService');
jest.mock('../../config/generalConfig');

const mockedUser: UserModel.User = {
  id: casual.integer(1, 999),
  getEmail: jest.fn().mockResolvedValue(casual.email),
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
};

describe('signinController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockCache: jest.Mocked<Cache>;
  let mockUser;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let context;

  beforeEach(async() => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockRequest = {
      body: {
        email: casual.email,
        password: casual.uuid,
      },
      logger: logger
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockCache = Cache.getInstance() as jest.Mocked<Cache>;
    (Cache.getInstance as jest.Mock).mockReturnValue(mockCache);

    mockUser = mockedUser;
    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should sign the user in and set the access and refresh tokens successfully', async () => {
    jest.spyOn(mockUser, 'login').mockResolvedValueOnce(mockedUser);
    (generateAuthTokens as jest.Mock).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    });

    await signinController(mockRequest as Request, mockResponse as Response);
    expect(generateAuthTokens).toHaveBeenCalled();
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspt', 'new-access-token', generalConfig.jwtTTL);
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspr', 'new-refresh-token', generalConfig.jwtRefreshTTL);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: 'ok' });
  });

  it('should return 401 if user login fails', async () => {
    jest.spyOn(mockUser, 'login').mockResolvedValueOnce(null);
    await signinController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Invalid credentials' });
  });

  it('should return 500 if unable to generate tokens', async () => {
    jest.spyOn(mockUser, 'login').mockResolvedValueOnce(mockedUser);
    (generateAuthTokens as jest.Mock).mockResolvedValue({});

    await signinController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Unable to sign in at this time' });
  });

  it('should return 500 if an unexpected error occurs', async () => {
    jest.spyOn(mockUser, 'login').mockResolvedValueOnce(mockedUser);
    const mockError = new Error('Unexpected error');
    (generateAuthTokens as jest.Mock).mockRejectedValue(mockError);

    await signinController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
  });
});
