import { Response } from 'express';
import { Request } from 'express-jwt';
import { Cache } from "../../datasources/cache";
import { revokeAccessToken, revokeRefreshToken, verifyAccessToken } from '../../services/tokenService';
import casual from 'casual';
import { signoutController } from '../signoutController';
import { buildMockContextWithToken } from "../../__mocks__/context";
import { MyContext } from '../../context';
import { logger } from "../../logger";

jest.mock('../../context.ts');

// Mocking external dependencies
jest.mock('../../datasources/cache');
jest.mock('../../services/tokenService');

describe('signoutController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockCache: jest.Mocked<Cache>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let context: MyContext;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockRequest = {
      logger: logger,
      auth: { jti: casual.integer(1, 99999).toString() },
      cookies: { dmspt: casual.uuid },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      clearCookie: jest.fn(),
    };
    mockCache = Cache.getInstance() as jest.Mocked<Cache>;
    (Cache.getInstance as jest.Mock).mockReturnValue(mockCache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should signout successfully', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValueOnce({ jti: mockRequest.auth.jti });
    (revokeRefreshToken as jest.Mock).mockResolvedValue(true);
    (revokeAccessToken as jest.Mock).mockResolvedValue({});
    jest.spyOn(mockResponse, 'clearCookie');

    await signoutController(mockRequest as Request, mockResponse as Response);

    expect(revokeRefreshToken).toHaveBeenCalled();
    expect(revokeAccessToken).toHaveBeenCalled();
    expect(mockResponse.clearCookie).toHaveBeenCalledWith('dmspt');
    expect(mockResponse.clearCookie).toHaveBeenCalledWith('dmspr');
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });

  it('should return 200 if no access token is present', async () => {
    await signoutController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });

  it('should return 200 if unable to revoke the refresh token', async () => {
    (revokeRefreshToken as jest.Mock).mockResolvedValue(false);

    await signoutController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });

  it('should return 200 if an unexpected error occurs', async () => {
    (revokeRefreshToken as jest.Mock).mockImplementation(() => { throw new Error('test error'); });
    await signoutController(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({});
  });
});
