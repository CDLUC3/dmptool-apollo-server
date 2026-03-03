import casual from "casual";
import { GraphQLResolveInfo, GraphQLError } from "graphql";
import { User, UserRole } from "../../models/User";
import { isAdmin, isSuperAdmin, authenticatedResolver } from "../authService";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { MyContext } from "../../context";
import { JWTAccessToken } from "../tokenService";

describe('isAdmin', () => {
  let token;
  beforeEach(() => {
    token = { id: casual.integer(1, 999), givenName: casual.first_name, surName: casual.last_name };
  });

  it('returns false if token is null', async () => {
    expect(isAdmin(null)).toBe(false);
  });

  it('returns false if token.role is not ADMIN or SUPERADMIN', async () => {
    token.role = UserRole.RESEARCHER;
    token.affiliationId = casual.url;
    expect(isAdmin(token)).toBeFalsy();
  });

  it('returns false if token.affiliationId is null', async () => {
    token.role = UserRole.ADMIN;
    expect(isAdmin(token)).toBeFalsy();
  });

  it('returns true if token.role is ADMIN', async () => {
    token.role = UserRole.ADMIN;
    token.affiliationId = casual.url;
    expect(isAdmin(token)).toBeTruthy();
  });

  it('returns true if token.role is SUPERADMIN', async () => {
    token.role = UserRole.SUPERADMIN;
    token.affiliationId = casual.url;
    expect(isAdmin(token)).toBeTruthy();
  });
});

describe('isSuperAdmin', () => {
  let token;
  beforeEach(() => {
    token = { id: casual.integer(1, 999), givenName: casual.first_name, surName: casual.last_name };
  });

  it('returns false if token is null', async () => {
    expect(isSuperAdmin(null)).toBeFalsy();
  });

  it('returns false if token.role is RESEARCHER', async () => {
    token.role = UserRole.RESEARCHER;
    token.affiliationId = casual.url;
    expect(isSuperAdmin(token)).toBeFalsy();
  });

  it('returns false if token.role is ADMIN', async () => {
    token.role = UserRole.ADMIN;
    token.affiliationId = casual.url;
    expect(isSuperAdmin(token)).toBeFalsy();
  });

  it('returns true if token.role is SUPERADMIN', async () => {
    token.role = UserRole.SUPERADMIN;
    token.affiliationId = casual.url;
    expect(isSuperAdmin(token)).toBeTruthy();
  });
});

describe('authenticatedResolver', () => {
  let mockResolver: jest.Mock;
  let mockContext: MyContext;
  let mockInfo: GraphQLResolveInfo;
  let token: JWTAccessToken;
  let user: User;

  beforeEach(async () => {
    user = new User({
      id: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.RESEARCHER,
      affiliationId: casual.url,
    });

    (user.getEmail as jest.Mock) = jest.fn().mockResolvedValue(casual.email);

    mockResolver = jest.fn().mockResolvedValue({success: true});
    mockContext = await buildMockContextWithToken(logger, user);
    token = mockContext.token;

    mockInfo = {} as GraphQLResolveInfo;
  });

  describe('RESEARCHER auth level (default)', () => {
    it('allows access with valid token', async () => {
      const wrapped = authenticatedResolver('test', UserRole.RESEARCHER, mockResolver);

      const result = await wrapped({}, {arg1: 'value'}, mockContext, mockInfo);

      expect(result).toEqual({success: true});
      expect(mockResolver).toHaveBeenCalledTimes(1);
    });

    it('throws AuthenticationError when token is null', async () => {
      mockContext.token = null;
      const wrapped = authenticatedResolver('test', UserRole.RESEARCHER, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow('Unauthorized');
      expect(mockResolver).not.toHaveBeenCalled();
    });
  });

  describe('ADMIN auth level', () => {
    it('allows access with ADMIN role and affiliationId', async () => {
      mockContext.token = {...token, role: UserRole.ADMIN};
      const wrapped = authenticatedResolver('test', UserRole.ADMIN, mockResolver);

      const result = await wrapped({}, {arg1: 'value'}, mockContext, mockInfo);

      expect(result).toEqual({success: true});
      expect(mockResolver).toHaveBeenCalledTimes(1);
    });

    it('allows access with SUPERADMIN role', async () => {
      mockContext.token = {...token, role: UserRole.SUPERADMIN};
      const wrapped = authenticatedResolver('test', UserRole.ADMIN, mockResolver);

      const result = await wrapped({}, {arg1: 'value'}, mockContext, mockInfo);

      expect(result).toEqual({success: true});
      expect(mockResolver).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenError with RESEARCHER role', async () => {
      mockContext.token = {...token, role: UserRole.RESEARCHER};
      const wrapped = authenticatedResolver('test', UserRole.ADMIN, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow('Forbidden');
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when affiliationId is missing', async () => {
      mockContext.token = {...token, role: UserRole.ADMIN, affiliationId: null};
      const wrapped = authenticatedResolver('test', UserRole.ADMIN, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow('Forbidden');
      expect(mockResolver).not.toHaveBeenCalled();
    });
  });

  describe('SUPERADMIN auth level', () => {
    it('allows access with SUPERADMIN role and affiliationId', async () => {
      mockContext.token = {...token, role: UserRole.SUPERADMIN};
      const wrapped = authenticatedResolver('test', UserRole.SUPERADMIN, mockResolver);

      const result = await wrapped({}, {arg1: 'value'}, mockContext, mockInfo);

      expect(result).toEqual({success: true});
      expect(mockResolver).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenError with ADMIN role', async () => {
      mockContext.token = {...token, role: UserRole.ADMIN};
      const wrapped = authenticatedResolver('test', UserRole.SUPERADMIN, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow('Forbidden');
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError with RESEARCHER role', async () => {
      mockContext.token = {...token, role: UserRole.RESEARCHER};
      const wrapped = authenticatedResolver('test', UserRole.SUPERADMIN, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow('Forbidden');
      expect(mockResolver).not.toHaveBeenCalled();
    });
  });

  describe('resolver execution', () => {
    it('executes resolver and returns result when authorized', async () => {
      const expectedResult = {data: 'test-data', count: 42};
      mockResolver.mockResolvedValue(expectedResult);
      const wrapped = authenticatedResolver('test', UserRole.RESEARCHER, mockResolver);

      const result = await wrapped({}, {}, mockContext, mockInfo);

      expect(result).toEqual(expectedResult);
    });

    it('passes correct arguments to resolver', async () => {
      const parent = {parentField: 'value'};
      const args = {arg1: 'value1', arg2: 123};
      const wrapped = authenticatedResolver('test', UserRole.RESEARCHER, mockResolver);

      await wrapped(parent, args, mockContext, mockInfo);

      expect(mockResolver).toHaveBeenCalledWith(parent, args, mockContext, mockInfo);
    });
  });

  describe('error handling', () => {
    it('rethrows GraphQLError without modification', async () => {
      const graphqlError = new GraphQLError('Custom GraphQL Error');
      mockResolver.mockRejectedValue(graphqlError);
      const wrapped = authenticatedResolver('test-reference', UserRole.RESEARCHER, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow(graphqlError);
      expect(mockContext.logger.error).not.toHaveBeenCalled();
    });

    it('logs and wraps non-GraphQLError in InternalServerError', async () => {
      const error = new Error('Some unexpected error');
      mockResolver.mockRejectedValue(error);
      const wrapped = authenticatedResolver('test-reference', UserRole.RESEARCHER, mockResolver);

      await expect(wrapped({}, {}, mockContext, mockInfo)).rejects.toThrow('Something went wrong');
      expect(mockContext.logger.error).toHaveBeenCalledWith(expect.any(Object), 'Failure in test-reference');
    });
  });
});

