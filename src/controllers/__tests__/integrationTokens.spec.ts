import { jest } from '@jest/globals';
import casual from 'casual';
import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'crypto';

import {
  mockAppConfigs,
  mockAppLogger,
  mockUserModel
} from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();
mockUserModel();

// Dynamic imports AFTER the mock is registered, so ESM module graph respects it
const { mockUser: mockUserFn, MockCache, buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { setupRouter } = await import('../../router.js');
const { Cache } = await import('../../datasources/cache.js');
const { csrfMiddleware } = await import('../../middleware/csrf.js');
const UserModel = await import('../../models/User.js');
const { generalConfig } = await import('../../config/generalConfig.js');
const { authMiddleware } = await import('../../middleware/auth.js');
const { verifyAccessToken } = await import('../../services/tokenService.js');
const { defaultLanguageId } = await import('../../models/Language.js');
const { getCurrentDate } = await import('../../utils/helpers.js');
const { getRandomEnumValue } = await import('../../__tests__/helpers.js');

let context;

function processResponseCookies(headers) {
  const cookies = {};
  if (headers && headers['set-cookie']?.length > 0) {
    for (const cookie of headers['set-cookie']) {
      const parts = cookie.split('=');
      cookies[parts[0]] = parts[1];
    }
  }
  return cookies;
}

let app: Application;
let mockedUserData;
let mockCache;

const mockedUser: InstanceType<typeof UserModel.User> = {
  id: casual.integer(1, 999),
  givenName: casual.first_name,
  surName: casual.last_name,
  affiliationId: null,
  role: UserModel.UserRole.RESEARCHER,
  acceptedTerms: true,
  password: casual.uuid,
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
  created: getCurrentDate(),
  modified: getCurrentDate(),
  errors: {},
  tableName: 'testUsers',
  getName: jest.fn(),
  getEmail: jest.fn<() => Promise<string>>().mockResolvedValue(casual.email), recordLogIn: jest.fn(),
  isValid: jest.fn(),
  validatePassword: jest.fn(),
  hashPassword: jest.fn(),
  prepForSave: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  setPassword: jest.fn(),
  addError: jest.fn(),
  hasErrors: jest.fn(),
  errorsToString: jest.fn(),
} as unknown as InstanceType<typeof UserModel.User>;

const mockProtectedController = async (req, res) => {
  if (req.auth && verifyAccessToken(context, req.cookies.dmspt)) {
    res.status(200).send({ message: 'ok' });
  } else {
    res.status(401).send({ message: 'nope' });
  }
};

beforeAll(async () => {
  app = express();
  app.use(bodyParser.json(), cookieParser());

  mockCache = MockCache.getInstance();
  jest.spyOn(Cache, 'getInstance').mockReturnValue(mockCache);

  app.use((req: Request, res: Response, next) => {
    req.logger = logger;
    req.cache = mockCache.adapter;
    next();
  });

  app.use('/test-protected', csrfMiddleware, authMiddleware, mockProtectedController);
  app.use('/', setupRouter(logger, mockCache.adapter, null, null));
});

beforeEach(async () => {
  jest.clearAllMocks();

  context = await buildMockContextWithToken(logger, mockUserFn(), mockCache.adapter);

  mockedUserData = {
    email: casual.email,
    givenName: casual.first_name,
    surName: casual.last_name,
    affiliationId: casual.url,
    role: 'RESEARCHER',
    acceptedTerms: true,
    password: casual.uuid,
  };
});

describe('CSRF', () => {
  it('GET /apollo-csrf should generate a CSRF token and add it as a header', async () => {
    const resp = await request(app).get('/apollo-csrf');

    expect(resp.statusCode).toEqual(200);
    expect(resp.headers['x-csrf-token']).toBeTruthy();

    const hashedToken = createHash('sha256')
      .update(`${resp.headers['x-csrf-token']}${generalConfig.hashTokenSecret}`)
      .digest('hex');
    expect(await mockCache.adapter.get(`{csrf}:${resp.headers['x-csrf-token']}`)).toEqual(hashedToken);
  });

  it('POST /test-protected should fail if the CSRF token is missing', async () => {
    const resp = await request(app).post('/test-protected').send({ msg: 'Should fail!' });

    expect(resp.statusCode).toEqual(403);
    expect(resp.headers['x-csrf-token']).toBeFalsy();
    expect(resp.body).toEqual({ error: 'Invalid CSRF token' });
  });

  it('POST /test-protected should fail if the CSRF token is invalid', async () => {
    const resp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', '1234567890')
      .send({ msg: 'Should fail!' });

    expect(resp.statusCode).toEqual(403);
    expect(resp.headers['x-csrf-token']).toBeFalsy();
    expect(resp.body).toEqual({ error: 'Invalid CSRF token' });
  });
});

describe('Sign up', () => {
  let mockUser: InstanceType<typeof UserModel.User>;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.resetStore();

    // Fixed: assign mockUser BEFORE using it in buildMockContextWithToken
    mockUser = mockedUser;
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];
    (UserModel.User as unknown as jest.Mock).mockImplementation(() => mockUser);
  });

  it('POST /apollo-signup should generate access token and refresh token cookies on success', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.register as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);
    const resp = await request(app)
      .post('/apollo-signup')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockedUserData));

    expect(resp.statusCode).toEqual(201);
    expect(resp.headers['x-csrf-token']).toBeTruthy();
    const cookies = processResponseCookies(resp.headers);
    expect(cookies['dmspt']).toBeTruthy();
    expect(resp.body).toEqual({ success: true, message: 'ok' });

    const cachedToken = Object.keys(mockCache.getStore()).find((key) => key.includes(`{dmspr}:`));
    expect(cachedToken).toBeTruthy();
  });

  it('POST /apollo-signup should NOT generate access token and refresh token cookies on invalid input', async () => {
    const registeredUser = mockedUser;
    registeredUser.errors = { foo: 'must be present', bar: 'must be present' };
    jest.spyOn(mockedUser, 'hasErrors').mockReturnValue(true);
    (mockedUser.register as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const resp = await request(app)
      .post('/apollo-signup')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockedUserData));

    expect(resp.statusCode).toEqual(400);
    expect(resp.headers['x-csrf-token']).toBeTruthy();
    expect(resp.headers['set-cookie']).toBeFalsy();
    expect(resp.body).toEqual({ success: false, message: Object.values(registeredUser.errors).join(' | ') });
  });

  it('POST /apollo-signup should NOT generate access token and refresh token cookies on failure', async () => {
    (mockedUser.register as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(null);

    const resp = await request(app)
      .post('/apollo-signup')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockedUserData));

    expect(resp.statusCode).toEqual(500);
    expect(resp.headers['x-csrf-token']).toBeTruthy();
    expect(resp.headers['set-cookie']).toBeFalsy();
    expect(resp.body).toEqual({ success: false, message: 'Unable to register the account.' });
  });
});

describe('Sign in', () => {
  let mockUser: InstanceType<typeof UserModel.User>;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.resetStore();

    mockUser = mockedUser;
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];
    (UserModel.User as unknown as jest.Mock).mockImplementation(() => mockUser);
  });

  it('POST /apollo-signin should generate access token and refresh token cookies on success', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(resp.statusCode).toEqual(200);
    expect(resp.headers['x-csrf-token']).toBeTruthy();
    const cookies = processResponseCookies(resp.headers);
    expect(cookies['dmspt']).toBeTruthy();
    expect(resp.body).toEqual({ success: true, message: 'ok' });

    const cachedToken = Object.keys(mockCache.getStore()).find((key) => key.includes(`{dmspr}:`));
    expect(cachedToken).toBeTruthy();

    const accessToken = cookies['dmspt'].split(';')[0];
    const refreshToken = cookies['dmspr'].split(';')[0];

    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', resp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=${accessToken}`, `dmspr=${refreshToken}`])
      .send(JSON.stringify({ message: 'testing' }));

    expect(protectedResp.statusCode).toEqual(200);
  });

  it('POST /apollo-signin should NOT generate access token and refresh token cookies on failure', async () => {
    (mockedUser.register as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(null);

    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockedUserData));

    expect(resp.statusCode).toEqual(401);
    expect(resp.headers['x-csrf-token']).toBeTruthy();
    expect(resp.headers['set-cookie']).toBeFalsy();
    expect(resp.body).toEqual({ success: false, message: 'Invalid credentials' });
  });
});

describe('Sign out', () => {
  let mockUser: InstanceType<typeof UserModel.User>;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.resetStore();

    mockUser = mockedUser;
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];
    (UserModel.User as unknown as jest.Mock).mockImplementation(() => mockUser);
  });

  it('POST /apollo-signout should remove cookies', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    expect(signinResp.headers['x-csrf-token']).toBeTruthy();
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];
    expect(accessToken).toBeTruthy();

    const signoutResp = await request(app)
      .post('/apollo-signout')
      .set('X-CSRF-Token', signinResp.headers['x-csrf-token'])
      .set('Cookie', [signinResp.headers['set-cookie']])
      .send(JSON.stringify({}));

    expect(signoutResp.statusCode).toEqual(200);
    expect(signoutResp.headers['x-csrf-token']).toBeTruthy();
    const signoutCookies = processResponseCookies(signoutResp.headers);
    expect(signoutCookies['dmspt']).toEqual('; Path');
    expect(signoutResp.body).toEqual({});

    const cachedRefresh = Object.keys(mockCache.getStore()).find((key) => key.includes(`{dmspr}:`));
    expect(cachedRefresh).toBeFalsy();
    const cachedToken = Object.keys(mockCache.getStore()).find((key) => key.includes(`{dmspbl}:`));
    expect(cachedToken).toBeTruthy();

    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', signoutResp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=${accessToken}`])
      .send('testing authorized access');

    expect(protectedResp.statusCode).toEqual(401);
    expect(protectedResp.headers['x-csrf-token']).toBeTruthy();
    const protectedCookies = processResponseCookies(protectedResp.headers);
    expect(protectedCookies['dmspt']).toBeFalsy();
    expect(protectedCookies['dmspr']).toBeFalsy();
  });

  it('should sign out when there is no access token', async () => {
    const signoutResp = await request(app)
      .post('/apollo-signout')
      .set('X-CSRF-Token', csrfToken)
      .send(JSON.stringify({}));

    expect(signoutResp.statusCode).toEqual(200);
    expect(signoutResp.headers['x-csrf-token']).toBeTruthy();
    const signoutCookies = processResponseCookies(signoutResp.headers);
    expect(signoutCookies['dmspt']).toBeFalsy();
    expect(signoutCookies['dmspr']).toBeFalsy();
    expect(signoutResp.body).toEqual({});
  });

  it('should sign out when the access token is invalid', async () => {
    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    const signoutResp = await request(app)
      .post('/apollo-signout')
      .set('X-CSRF-Token', resp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=TESTING-BOGUS-TOKEN`])
      .send(JSON.stringify({}));

    expect(signoutResp.statusCode).toEqual(401);
    expect(signoutResp.headers['x-csrf-token']).toBeTruthy();
    const signoutCookies = processResponseCookies(signoutResp.headers);
    expect(signoutCookies['dmspt']).toBeFalsy();
    expect(signoutCookies['dmspr']).toBeFalsy();
    expect(signoutResp.body).toEqual({});
  });

  it('should sign out when the access token has been revoked', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];

    const jwt = verifyAccessToken(context, accessToken);
    mockCache.adapter.set(`{dmspbl}:${jwt.jti}`, 'testing revocation', {});

    const signoutResp = await request(app)
      .post('/apollo-signout')
      .set('X-CSRF-Token', signinResp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=${accessToken}`])
      .send(JSON.stringify({}));

    expect(signoutResp.statusCode).toEqual(401);
    expect(signoutResp.headers['x-csrf-token']).toBeTruthy();
    const signoutCookies = processResponseCookies(signoutResp.headers);
    expect(signoutCookies['dmspt']).toBeFalsy();
    expect(signoutCookies['dmspr']).toBeFalsy();
    expect(signoutResp.body).toEqual({});
  });
});

describe('token refresh', () => {
  let mockUser: InstanceType<typeof UserModel.User>;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.resetStore();

    mockUser = mockedUser;
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];
    (UserModel.User as unknown as jest.Mock).mockImplementation(() => mockUser);
  });

  it('returns a 401 if the refresh token is not present', async () => {
    const respRefresh = await request(app)
      .post('/apollo-refresh')
      .set('X-CSRF-Token', csrfToken)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({}));

    expect(respRefresh.statusCode).toEqual(401);
    expect(respRefresh.body).toEqual({ success: false, message: 'No refresh token available' });
    expect(respRefresh.headers['x-csrf-token']).toBeTruthy();
    const cookies = processResponseCookies(respRefresh.headers);
    expect(cookies['dmspt']).toBeFalsy();
    expect(cookies['dmspr']).toBeFalsy();
  });

  it('returns a 401 if an error occurs', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    const signinCookies = processResponseCookies(resp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];
    const refreshToken = signinCookies['dmspr'].split(';')[0];
    const jwt = verifyAccessToken(context, accessToken);

    const hashedToken = createHash('sha256')
      .update(`${refreshToken}${generalConfig.hashTokenSecret}`)
      .digest('hex');
    expect(await mockCache.adapter.get(`{dmspr}:${jwt.jti}`)).toEqual(hashedToken);

    const errMock = jest.fn().mockImplementation(() => { throw new Error('testing'); });
    (UserModel.User.findById as jest.Mock) = errMock;

    const respRefresh = await request(app)
      .post('/apollo-refresh')
      .set('X-CSRF-Token', resp.headers['x-csrf-token'])
      .set('Content-Type', 'application/json')
      .set('Cookie', [`dmspr=${refreshToken}`])
      .send(JSON.stringify({}));

    expect(respRefresh.statusCode).toEqual(401);
    expect(respRefresh.body).toEqual({ success: false, message: 'Server error: unable to refresh tokens at this time' });
    expect(respRefresh.headers['x-csrf-token']).toBeTruthy();
    const cookies = processResponseCookies(respRefresh.headers);
    expect(cookies['dmspt']).toBeFalsy();
    expect(cookies['dmspr']).toBeFalsy();
  });

  it('should return a 401 when the refresh token has expired', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const originalTTL = generalConfig.jwtRefreshTTL;
    generalConfig.jwtRefreshTTL = 1;

    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];
    const refreshToken = signinCookies['dmspr'].split(';')[0];

    await new Promise((r) => setTimeout(r, 1000));

    const respRefresh = await request(app)
      .post('/apollo-refresh')
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', [`dmspt=${accessToken}`])
      .set('Cookie', [`dmspr=${refreshToken}`])
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({}));

    generalConfig.jwtRefreshTTL = originalTTL;

    expect(respRefresh.statusCode).toEqual(401);
    expect(respRefresh.headers['x-csrf-token']).toBeTruthy();
    const protectedCookies = processResponseCookies(respRefresh.headers);
    expect(protectedCookies['dmspt']).toBeFalsy();
    expect(protectedCookies['dmspr']).toBeFalsy();
  });

  it('returns a 200 along with a new Access token if successful', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    const cookies = processResponseCookies(resp.headers);
    const accessToken = cookies['dmspt'].split(';')[0];
    const refreshToken = cookies['dmspr'].split(';')[0];
    const jwt = verifyAccessToken(context, accessToken);

    const hashedToken = createHash('sha256')
      .update(`${refreshToken}${generalConfig.hashTokenSecret}`)
      .digest('hex');
    expect(await mockCache.adapter.get(`{dmspr}:${jwt.jti}`)).toEqual(hashedToken);

    (UserModel.User.findById as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    await new Promise((r) => setTimeout(r, 1000));

    const respRefresh = await request(app)
      .post('/apollo-refresh')
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', [`dmspt=${accessToken}`])
      .set('Cookie', [`dmspr=${refreshToken}`])
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({}));

    expect(respRefresh.statusCode).toEqual(200);
    expect(respRefresh.body).toEqual({ success: true, message: 'ok' });
    expect(respRefresh.headers['x-csrf-token']).toBeTruthy();
    const refreshCookies = processResponseCookies(respRefresh.headers);
    const refreshedAccess = refreshCookies['dmspt'].split(';')[0];

    // The refresh token is NOT reissued on a successful access-token refresh —
    // it stays the same as what the client already has.
    expect(refreshedAccess).not.toEqual(accessToken);
    expect(refreshCookies['dmspr']).toBeUndefined();

  });
});

describe('protected endpoint access', () => {
  let mockUser: InstanceType<typeof UserModel.User>;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.resetStore();

    mockUser = mockedUser;
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];
    (UserModel.User as unknown as jest.Mock).mockImplementation(() => mockUser);
  });

  it('should return a 401 when there is no access token', async () => {
    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', csrfToken)
      .send('testing unauthorized access');

    expect(protectedResp.statusCode).toEqual(401);
    expect(protectedResp.headers['x-csrf-token']).toBeTruthy();
    const protectedCookies = processResponseCookies(protectedResp.headers);
    expect(protectedCookies['dmspt']).toBeFalsy();
    expect(protectedCookies['dmspr']).toBeFalsy();
  });

  it('should return a 401 when the access token is invalid', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', resp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=TESTING-BOGUS-TOKEN`])
      .send(JSON.stringify({}));

    expect(protectedResp.statusCode).toEqual(401);
    expect(protectedResp.headers['x-csrf-token']).toBeTruthy();
    const protectedCookies = processResponseCookies(protectedResp.headers);
    expect(protectedCookies['dmspt']).toBeFalsy();
    expect(protectedCookies['dmspr']).toBeFalsy();
  });

  it('should return a 401 when the access token has expired', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const originalTTL = generalConfig.jwtTTL;
    generalConfig.jwtTTL = 1;

    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];
    await new Promise((r) => setTimeout(r, 1000));

    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', signinResp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=${accessToken}`])
      .send('testing unauthorized access');

    generalConfig.jwtTTL = originalTTL;

    expect(protectedResp.statusCode).toEqual(401);
    expect(protectedResp.headers['x-csrf-token']).toBeTruthy();
    const protectedCookies = processResponseCookies(protectedResp.headers);
    expect(protectedCookies['dmspt']).toBeFalsy();
    expect(protectedCookies['dmspr']).toBeFalsy();
  });

  it('should return a 401 when the token has been revoked (in the black list)', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.MockedFunction<() => Promise<InstanceType<typeof UserModel.User>>>).mockResolvedValueOnce(registeredUser);

    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];

    const jwt = verifyAccessToken(context, accessToken);
    mockCache.adapter.set(`{dmspbl}:${jwt.jti}`, 'testing revocation', {});

    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', signinResp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=${accessToken}`])
      .send('testing unauthorized access');

    expect(protectedResp.statusCode).toEqual(401);
    expect(protectedResp.headers['x-csrf-token']).toBeTruthy();
    const protectedCookies = processResponseCookies(protectedResp.headers);
    expect(protectedCookies['dmspt']).toBeFalsy();
    expect(protectedCookies['dmspr']).toBeFalsy();
  });
});