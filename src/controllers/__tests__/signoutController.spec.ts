import { jest } from '@jest/globals';
import { Response } from 'express';
import { Request } from 'express-jwt';
import casual from 'casual';
import { logger } from "../../logger.js";

jest.unstable_mockModule('../../datasources/cache.js', () => ({
  Cache: {
    getInstance: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/tokenService.js', () => ({
  revokeAccessToken: jest.fn<() => Promise<boolean>>(),
  revokeRefreshToken: jest.fn<() => Promise<boolean>>(),
  verifyAccessToken: jest.fn<() => { jti: string }>(),
}));


const {
  revokeAccessToken,
  revokeRefreshToken,
  verifyAccessToken,
} = await import('../../services/tokenService.js');

const { signoutController } = await import('../signoutController.js');

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  clearCookie: jest.Mock;
};

describe('signoutController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;
  beforeEach(async () => {
    jest.resetAllMocks();

    mockRequest = {
      logger,
      auth: { jti: casual.integer(1, 99999).toString() },
      cookies: { dmspt: casual.uuid },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should signout successfully', async () => {
    jest.mocked(verifyAccessToken).mockReturnValueOnce({
      jti: mockRequest.auth!.jti,
    });

    jest.mocked(revokeRefreshToken).mockResolvedValue(true);

    jest.mocked(revokeAccessToken).mockResolvedValue(true);
    jest.spyOn(mockResponse, 'clearCookie');

    await signoutController(mockRequest as Request, mockResponse as unknown as Response);

    expect(revokeRefreshToken).toHaveBeenCalled();
    expect(revokeAccessToken).toHaveBeenCalled();
    expect(mockResponse.clearCookie).toHaveBeenCalledWith('dmspt');
    expect(mockResponse.clearCookie).toHaveBeenCalledWith('dmspr');
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });

  it('should return 200 if no access token is present', async () => {
    await signoutController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });

  it('should return 200 if unable to revoke the refresh token', async () => {
    jest.mocked(revokeRefreshToken).mockResolvedValue(false);

    await signoutController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });

  it('should return 200 if an unexpected error occurs', async () => {
    jest.mocked(revokeRefreshToken).mockImplementation(() => { throw new Error('test error'); });
    await signoutController(mockRequest as Request, mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });
});
