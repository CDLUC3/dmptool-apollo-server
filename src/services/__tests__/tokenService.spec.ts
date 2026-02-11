import casual from 'casual';
import jwt, { Jwt } from 'jsonwebtoken';
import { createHash } from 'crypto';
import { Response } from 'express';
import { User, UserRole } from '../../models/User';
import { DEFAULT_INTERNAL_SERVER_MESSAGE, DEFAULT_UNAUTHORIZED_MESSAGE } from '../../utils/graphQLErrors';
import { Cache } from '../../datasources/cache';
import { generalConfig } from '../../config/generalConfig';
import {
  setTokenCookie,
  generateAuthTokens,
  refreshAccessToken,
  revokeAccessToken,
  revokeRefreshToken,
  isRevokedCallback,
  verifyCSRFToken,
  generateCSRFToken,
} from '../tokenService'; // assuming the original code is in auth.ts
import { buildContext, mockToken, MockCache } from '../../__mocks__/context';
import { defaultLanguageId } from '../../models/Language';
import { logger } from "../../logger";

jest.mock('jsonwebtoken');
jest.mock('../../datasources/cache');

// Mock the process.env
const originalEnv = process.env;

let context;
let mockUser;
let mockCache;

beforeEach(() => {
  jest.clearAllMocks();

  // Setup the Mock Cache that will be attached to the Apollo context
  mockCache = MockCache.getInstance();

  mockUser = {
    id: casual.integer(1, 999),
    givenName: casual.first_name,
    surName: casual.last_name,
    affiliationId: casual.url,
    role: UserRole.RESEARCHER,
    languageId: defaultLanguageId,
    getEmail: jest.fn().mockResolvedValue(casual.email)
  };
});

describe('setTokenCookie', () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = { cookie: jest.fn() };
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should set a cookie with the provided name and value', () => {
    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'testCookie',
      'testValue',
      expect.any(Object)
    );
  });

  it('should set httpOnly to true', () => {
    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
      })
    );
  });

  it('should set secure to true in production environment', () => {
    process.env.NODE_ENV = 'production';
    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        secure: true,
      })
    );
  });

  it('should set secure to false in non-production environment', () => {
    process.env.NODE_ENV = 'development';
    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        secure: false,
      })
    );
  });

  it('should set path to /', () => {
    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        path: '/',
      })
    );
  });

  it('should use provided maxAge when given', () => {
    const maxAge = 3600000; // 1 hour in milliseconds
    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue', maxAge);
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        maxAge: maxAge,
      })
    );
  });

  it('should use JWT TTL from env when maxAge is not provided', () => {
    generalConfig.jwtTTL = 90;

    setTokenCookie(mockResponse as Response, 'testCookie', 'testValue');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        maxAge: 90,
      })
    );
  });
});

describe('generateCSRFToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCache.resetStore();
  });

  it('should generate a CSRF token and store the hashed version in the cache', async () => {
    jest.spyOn(mockCache.adapter, 'set');
    expect(await generateCSRFToken(mockCache.adapter)).toBeTruthy();
  });

  it('should return null if it is unable to store the CSRF token in the cache', async () => {
    const mockError = new Error('test CSRF failure');
    jest.spyOn(mockCache.adapter, 'set').mockImplementation(() => { throw mockError; });

    expect(await generateCSRFToken(mockCache.adapter)).toEqual(null);
    expect(logger.error).toHaveBeenLastCalledWith(mockError, 'generateCSRFToken error!');
  });
});

describe('generateAuthTokens', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = buildContext(logger, await mockToken(), mockCache.adapter);
  });

  it('should generate access and refresh tokens', async () => {
    const mockAccessToken = 'mock-access-token';
    const mockRefreshToken = 'mock-refresh-token';

    const mockDate = new Date();
    jest.useFakeTimers().setSystemTime(mockDate);

    (jwt.sign as jest.Mock).mockImplementation((_payload, secret) => {
      if (secret === generalConfig.jwtSecret) return mockAccessToken;
      if (secret === generalConfig.jwtRefreshSecret) return mockRefreshToken;
    });
    jest.spyOn(mockCache.adapter, 'set').mockResolvedValue(true);

    const result = await generateAuthTokens(context, mockUser);

    expect(result).toEqual({ accessToken: mockAccessToken, refreshToken: mockRefreshToken });
    expect(jwt.sign).toHaveBeenCalledTimes(2);
    expect(mockCache.adapter.set).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should return null tokens if conditions are not met', async () => {
    const result = await generateAuthTokens(context, {} as User);
    expect(result).toEqual({ accessToken: null, refreshToken: null });
  });
});

describe('verifyCSRFToken', () => {
  it('returns true when the CSRF token matches the hashed token in the cache', async () => {
    const token = 'csrf-token';
    const hashed = createHash('sha256').update(`${token}${generalConfig.hashTokenSecret}`).digest('hex');

    jest.spyOn(mockCache.adapter, 'get').mockResolvedValue(hashed);

    expect(await verifyCSRFToken(mockCache.adapter, token)).toBe(true);
  });

  it('returns false when the CSRF token does NOT match the hashed token in the cache', async () => {
    const token = 'csrf-token';
    const hashed = 'hashed-token';

    jest.spyOn(mockCache.adapter, 'get').mockResolvedValue(hashed);

    expect(await verifyCSRFToken(mockCache, token)).toBe(false);
  });
});

describe('isRevokedCallback', () => {
  let mockDirectCache;

  beforeEach(() => {
    jest.clearAllMocks();

    // The function makes direct calls to Cache.getInstance() so mock it here
    (Cache.getInstance as jest.Mock).mockReturnValue({
      adapter: {
        delete: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
      },
    });
    mockDirectCache = Cache.getInstance();
  });

  it('returns false if the token is null or it has no payload', async () => {
    expect(await isRevokedCallback(null, null)).toBe(false);
  });

  it('returns false if the token has no payload', async () => {
    const token = { header: null, signature: null, payload: null };

    expect(await isRevokedCallback(null, token as Jwt)).toBe(false);
  });

  it('logs an error and returns false if an error is thrown', async () => {
    const mockJti = casual.integer(1, 99999).toString();
    const token = { header: null, signature: null, payload: { jti: mockJti } };

    const mockErr = new Error('Test cache error');
    (mockDirectCache.adapter.get as jest.Mock).mockImplementation(() => { throw mockErr; });

    await isRevokedCallback(null, token as Jwt);
    const expoectedErr = 'isRevokedCallback - unable to fetch token from cache';
    expect(mockDirectCache.adapter.get).toHaveBeenLastCalledWith(`{dmspbl}:${mockJti}`);
    expect(logger.error).toHaveBeenLastCalledWith(mockErr, expoectedErr);
  });

  it('returns true if the token is black listed', async () => {
    const mockJti = casual.integer(1, 99999).toString();
    const token = { header: null, signature: null, payload: { jti: mockJti } };

    (mockDirectCache.adapter.get as jest.Mock).mockReturnValueOnce(mockJti);

    expect(await isRevokedCallback(null, token as Jwt)).toBe(true);
    expect(mockDirectCache.adapter.get).toHaveBeenLastCalledWith(`{dmspbl}:${mockJti}`);
  });
});

describe('refreshAccessToken', () => {
  let context;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = buildContext(logger, await mockToken(), mockCache.adapter);
  });

  it('should refresh the access token if refresh token is valid', async () => {
    const mockRefreshToken = 'valid-refresh-token';
    const hashedToken = createHash('sha256').update(`${mockRefreshToken}${generalConfig.hashTokenSecret}`).digest('hex');
    const mockNewAccessToken = 'valid-access-token';
    const mockNewRefreshToken = 'valid-refresh-token';

    (jwt.verify as jest.Mock).mockImplementation(() => { return mockUser; });
    jest.spyOn(mockCache.adapter, 'get').mockResolvedValue(hashedToken);
    jest.spyOn(User, 'findById').mockResolvedValue(mockUser);
    (jwt.sign as jest.Mock).mockImplementation((_payload, secret) => {
      if (secret === generalConfig.jwtSecret) return mockNewAccessToken;
      if (secret === generalConfig.jwtRefreshSecret) return mockNewRefreshToken;
    })

    const result = await refreshAccessToken(context, mockRefreshToken);

    expect(result).toEqual(mockNewAccessToken);
    expect(jwt.verify).toHaveBeenCalledWith(mockRefreshToken, generalConfig.jwtRefreshSecret);
  });

  it('should throw an AuthenticationError if the User could not be found', async () => {
    const mockRefreshToken = 'revoked-refresh-token';
    const hashedToken = createHash('sha256').update(`${mockRefreshToken}${generalConfig.hashTokenSecret}`).digest('hex');
    const mockUserId = casual.integer(1, 999);

    (jwt.verify as jest.Mock).mockImplementation(() => { return { id: mockUserId }; });
    jest.spyOn(mockCache.adapter, 'get').mockResolvedValue(hashedToken);
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    await expect(refreshAccessToken(context, mockRefreshToken))
      .rejects.toThrow(DEFAULT_UNAUTHORIZED_MESSAGE);
  });

  it('should throw an AuthenticationError if the refresh token is invalid', async () => {
    const mockRefreshToken = 'revoked-refresh-token';

    (jwt.verify as jest.Mock).mockReturnValue(null);

    await expect(refreshAccessToken(context, mockRefreshToken))
      .rejects.toThrow(DEFAULT_UNAUTHORIZED_MESSAGE);
  });

  it('should throw an AuthenticationError if RefreshToken does not match the one stored in the cache', async () => {
    const mockRefreshToken = 'invalid-refresh-token';
    const mockHashed = 'mismatched-hash';
    const mockUserId = casual.integer(1, 999);
    const errorMessage = 'Invalid refresh token';

    (jwt.verify as jest.Mock).mockImplementation(() => { return { id: mockUserId }; });
    jest.spyOn(mockCache.adapter, 'get').mockResolvedValue(mockHashed);

    await expect(refreshAccessToken(context, mockRefreshToken))
      .rejects.toThrow(`${DEFAULT_UNAUTHORIZED_MESSAGE} - ${errorMessage}`);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw an AuthenticationError if something throws an error', async () => {
    const mockRefreshToken = 'invalid-refresh-token';
    const errorMessage = 'Invalid refresh token';

    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error(errorMessage);
    });;

    await expect(refreshAccessToken(context, mockRefreshToken))
      .rejects.toThrow(`${DEFAULT_UNAUTHORIZED_MESSAGE} - ${errorMessage}`);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('revokeRefreshToken', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = buildContext(logger, await mockToken(), mockCache.adapter);
  });

  it('should delete the token from the cache', async () => {
    const mockUserJti = casual.integer(1, 999999).toString();
    jest.spyOn(mockCache.adapter, 'delete').mockResolvedValue(true);

    const result = await revokeRefreshToken(context, mockUserJti);

    expect(result).toBe(true);
    expect(mockCache.adapter.delete).toHaveBeenCalledWith(`{dmspr}:${mockUserJti}`);
  });

  it('should throw and error and log error on failure', async () => {
    const mockError = new Error('Test error');
    jest.spyOn(mockCache.adapter, 'delete').mockImplementation(() => { throw mockError });

    const expectedErr = `${DEFAULT_INTERNAL_SERVER_MESSAGE} - Test error`;
    await expect(() => revokeRefreshToken(context, 'mock-token')).rejects.toThrow(expectedErr);
    const thrownErr = `revokeRefreshToken - unable to delete token from cache`;
    expect(logger.error).toHaveBeenCalledWith({}, thrownErr);
  });
});

describe('revokeAccessToken', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = buildContext(logger, await mockToken(), mockCache.adapter);
  });

  it('should add the token to the cache black list', async () => {
    const mockJti = casual.integer(1, 999999).toString();
    jest.spyOn(mockCache.adapter, 'set');

    const result = await revokeAccessToken(context, mockJti);

    expect(result).toBe(true);
    expect(mockCache.adapter.set).toHaveBeenCalled();
  });

  it('should throw and error and log error on failure', async () => {
    const mockJti = casual.integer(1, 999999).toString();
    const mockError = new Error('Test error');
    jest.spyOn(mockCache.adapter, 'set').mockImplementation(() => { throw mockError });

    const expectedErr = `${DEFAULT_INTERNAL_SERVER_MESSAGE} - Test error`;
    await expect(() => revokeAccessToken(context, mockJti)).rejects.toThrow(expectedErr);
    const thrownErr = `revokeAccessToken - unable to add token to black list`;
    expect(logger.error).toHaveBeenCalledWith({}, thrownErr);
  });
});
