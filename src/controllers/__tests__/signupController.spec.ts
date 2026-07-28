import casual from 'casual';
import { Request, Response } from 'express';
import { Cache } from "../../datasources/cache";
import { generateAuthTokens, setTokenCookie } from '../../services/tokenService';
import { generalConfig } from '../../config/generalConfig';
import * as UserModel from '../../models/User';
import { signupController } from '../signupController';
import { defaultLanguageId } from '../../models/Language';
import { getCurrentDate } from '../../utils/helpers';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { mockUser as mockUserFn } from '../../__mocks__/context';

jest.mock('../../context.ts');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let context;

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
  acceptedTerms: true,
  languageId: defaultLanguageId,
  password: casual.uuid,
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
  prepForSave: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  addError: jest.fn(),
  hasErrors: jest.fn(),
  errorsToString: jest.fn(),
};

describe('signupController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockCache: jest.Mocked<Cache>;
  let mockUser;

  beforeEach(async() => {
    jest.resetAllMocks();

    mockUser = mockUserFn();

    context = await buildMockContextWithToken(logger, mockUser);

    mockRequest = {
      logger: logger,
      body: {
        email: casual.email,
        givenName: casual.first_name,
        surName: casual.last_name,
        password: casual.uuid,
        affiliationId: casual.url,
        role: UserModel.UserRole.RESEARCHER,
      }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockCache = Cache.getInstance() as jest.Mocked<Cache>;
    (Cache.getInstance as jest.Mock).mockReturnValue(mockCache);

    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should sign the user in and set the access and refresh tokens successfully', async () => {
    jest.spyOn(mockUser, 'register').mockResolvedValueOnce(mockUser);
    (generateAuthTokens as jest.Mock).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    });

    await signupController(mockRequest as Request, mockResponse as Response);

    expect(generateAuthTokens).toHaveBeenCalled();
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspt', 'new-access-token', generalConfig.jwtTTL);
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspr', 'new-refresh-token', generalConfig.jwtRefreshTTL);
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: 'ok' });
  });

  it('should return 400 if user is invalid', async () => {
    mockUser.errors = { 'email': 'Invalid email' };
    mockUser.hasErrors = jest.fn().mockReturnValue(true)
    jest.spyOn(mockUser, 'register').mockResolvedValueOnce(mockUser);

    await signupController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json)
      .toHaveBeenCalledWith({ success: false, message: Object.values(mockUser.errors).join(' | ') });
    mockUser.errors = [];
  });

  it('should return 500 if user registration fails for some unknown reason', async () => {
    jest.spyOn(mockUser, 'register').mockResolvedValueOnce(null);
    await signupController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json)
      .toHaveBeenCalledWith({ success: false, message: 'Unable to register the account.' });
  });

  it('should return 500 if unable to generate tokens', async () => {
    jest.spyOn(mockUser, 'register').mockResolvedValueOnce(mockedUser);
    (generateAuthTokens as jest.Mock).mockResolvedValue({});

    await signupController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Unable to create the account at this time.' });
  });

  it('should return 500 if an unexpected error occurs', async () => {
    jest.spyOn(mockUser, 'register').mockResolvedValueOnce(mockedUser);
    const mockError = new Error('Unexpected error');
    (generateAuthTokens as jest.Mock).mockRejectedValue(mockError);

    await signupController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
  });
});
