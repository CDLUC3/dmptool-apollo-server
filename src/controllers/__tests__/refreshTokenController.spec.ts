import { jest } from '@jest/globals';
import casual from 'casual';
import { Response } from 'express';
import { Request } from 'express-jwt';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

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
  refreshAccessToken: jest.fn<() => Promise<string | null>>(),
  setTokenCookie: jest.fn(),
}));

// Dynamic imports AFTER all mocks are registered
const { refreshAccessToken, setTokenCookie } = await import('../../services/tokenService.js');
const { refreshTokenController } = await import('../refreshTokenController.js');
const { buildContext } = await import('../../context.js');
const { logger } = await import('../../logger.js');


interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

describe('refreshTokenController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Re-apply the buildContext mock's return value AFTER resetAllMocks,
    // since resetAllMocks strips implementations set at factory time.
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
      auth: { jti: casual.integer(1, 99999).toString(), id: casual.integer(1, 999) },
      headers: { 'x-refresh-token': 'old-refresh-token' },
      logger: logger
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should refresh tokens successfully', async () => {
    mockRequest.cookies = { dmspr: 'old-refresh-token' };

    jest.mocked(refreshAccessToken).mockResolvedValue('new-access-token');

    await refreshTokenController(mockRequest as Request, mockResponse as unknown as Response);

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(setTokenCookie).toHaveBeenCalledWith(mockResponse, 'dmspt', 'new-access-token');
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: 'ok' });
  });

  it('should return 401 if refresh token is missing', async () => {
    await refreshTokenController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'No refresh token available' });
  });

  it('should return 401 if unable to refresh tokens', async () => {
    mockRequest.cookies = { dmspr: 'old-refresh-token' };
    jest.mocked(refreshAccessToken).mockResolvedValue(null);

    await refreshTokenController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Refresh token has expired' });
  });

  it('should return 500 if an unexpected error occurs', async () => {
    mockRequest.cookies = { dmspr: 'old-refresh-token' };
    jest.mocked(refreshAccessToken).mockRejectedValue(new Error('Unexpected error'));

    await refreshTokenController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Server error: unable to refresh tokens at this time' });
  });
});
