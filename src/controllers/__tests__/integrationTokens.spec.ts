import casual from 'casual';
import express, {Application, Request, Response} from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'crypto';
import { setupRouter } from '../../router';
import { Cache } from '../../datasources/cache';
import { csrfMiddleware } from '../../middleware/csrf';
import * as UserModel from '../../models/User';
import { generalConfig } from '../../config/generalConfig';
import { authMiddleware } from '../../middleware/auth';
import { verifyAccessToken } from '../../services/tokenService';
import { defaultLanguageId } from '../../models/Language';
import { getCurrentDate } from '../../utils/helpers';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { mockUser, MockCache, buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock('../../datasources/cache');
jest.mock('../../datasources/dmphubAPI');

let context;

// Process the response cookies into an object since cookies are returned in the `set-cookie` header in
// supertest and each one is a string like `cookieName=cookieValue`
function processResponseCookies(headers) {
  const cookies = {};

  if (headers && headers['set-cookie']?.length > 0) {
    for(const cookie of headers['set-cookie']) {
    // for (let i = 0; i < headers['set-cookie'].length; i++) {
      const parts = cookie.split('=');
      cookies[parts[0]] = parts[1]
    }
  }
  return cookies;
}

let app: Application;
let mockedUserData;
let mockCache;

const mockedUser: UserModel.User = {
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
  getEmail: jest.fn().mockResolvedValue(casual.email),
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
  errorsToString: jest.fn()
};

// Mock a protected endpoint because it's easier than building the entire apollo server stack
const mockProtectedController = async (req, res) => {
  // If the token was properly decoded by express-jwt AND we can verify it manually (to test expiry)
  if (req.auth && verifyAccessToken(context, req.cookies.dmspt)) {
    res.status(200).send({ message: 'ok' });
  } else {
    res.status(401).send({ message: 'nope' });
  }
}

beforeAll(async () => {
  app = express();
  app.use(
    bodyParser.json(),
    cookieParser(),
  );

  mockCache = MockCache.getInstance();
  (Cache.getInstance as jest.Mock).mockReturnValue(mockCache);

  // Pass in the logger and cache
  app.use((req: Request, res: Response, next) => {
    req.logger = logger;
    req.cache = mockCache.adapter;

    next();
  });
  app.use('/test-protected',
    csrfMiddleware,
    authMiddleware,
    mockProtectedController,
  );

  app.use('/', setupRouter(logger, mockCache.adapter, null, null));
});

beforeEach(async() => {
  jest.clearAllMocks();

  context = await buildMockContextWithToken(logger, mockUser(), mockCache.adapter);

  mockedUserData = {
    email: casual.email,
    givenName: casual.first_name,
    surName: casual.last_name,
    affiliationId: casual.url,
    role: 'RESEARCHER',
    acceptedTerms: true,
    password: casual.uuid,
  }
});

describe('CSRF', () => {
  it('GET /apollo-csrf should generate a CSRF token and add it as a header', async () => {
    const resp = await request(app)
      .get('/apollo-csrf');

    expect(resp.statusCode).toEqual(200);
    expect(resp.headers['x-csrf-token']).toBeTruthy();

    // Make sure the cache contains the hashed version of the CSRF token
    const hashedToken = createHash('sha256')
      .update(`${resp.headers['x-csrf-token']}${generalConfig.hashTokenSecret}`)
      .digest('hex');
    expect(await mockCache.adapter.get(`{csrf}:${resp.headers['x-csrf-token']}`)).toEqual(hashedToken);
  });

  it('POST /test-protected should fail if the CSRF token is missing', async () => {
    const resp = await request(app)
      .post('/test-protected')
      .send({ msg: 'Should fail!' });

    expect(resp.statusCode).toEqual(403);
    expect(resp.headers['x-csrf-token']).toBeFalsy();
    expect(resp.body).toEqual({ error: 'Invalid CSRF token'});
  });

  it('POST /test-protected should fail if the CSRF token is invalid', async () => {
    const resp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', '1234567890')
      .send({ msg: 'Should fail!' });

    expect(resp.statusCode).toEqual(403);
    expect(resp.headers['x-csrf-token']).toBeFalsy();
    expect(resp.body).toEqual({ error: 'Invalid CSRF token'});
  });
});

describe('Sign up', () => {
  let mockUser: UserModel.User;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = await buildMockContextWithToken(logger, mockUser, mockCache);;

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];

    mockUser = mockedUser;
    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
  });

  it('POST /apollo-signup should generate access token and refresh token cookies on success', async () => {
    // Simulate the newly registered user (needs an id!)
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.register as jest.Mock).mockResolvedValueOnce(registeredUser);

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

    // Make sure the cache contains the refresh tokens
    const cachedToken = Object.keys(  mockCache.getStore()).find((key) => {
      return key.includes(`{dmspr}:`)
    });
    expect(cachedToken).toBeTruthy();
  });

  it('POST /apollo-signup should NOT generate access token and refresh token cookies on invalid input', async () => {
    // Simulate invalid input causing a register failure
    const registeredUser = mockedUser;
    registeredUser.errors = { foo: 'must be present', bar: 'must be present' };
    jest.spyOn(mockedUser, 'hasErrors').mockReturnValue(true);
    (mockedUser.register as jest.Mock).mockResolvedValueOnce(registeredUser);

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
    // Simulate a fatal register failure
    (mockedUser.register as jest.Mock).mockResolvedValueOnce(null);

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
  let mockUser: UserModel.User;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = await buildMockContextWithToken(logger, mockUser, mockCache);
    // context = buildContext(logger, mockToken(), mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];

    mockUser = mockedUser;
    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
  });

  it.only('POST /apollo-signin should generate access token and refresh token cookies on success', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

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

    // Make sure the cache contains the refresh tokens
    const cachedToken = Object.keys(  mockCache.getStore()).find((key) => {
      return key.includes(`{dmspr}:`)
    });
    expect(cachedToken).toBeTruthy();

    //Now make sure the user can make a call to a protected resource
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
    // Simulate a fatal register failure
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(null);

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
  let mockUser: UserModel.User;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];

    mockUser = mockedUser;
    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
  });

  it('POST /apollo-signout should remove cookies', async () => {
    const registeredUser = mockedUser;
    registeredUser.id = casual.integer(1, 999);
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // First signin so we have cookies and a refresh token in the cache
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

    // Then signout
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

    // Make sure the cache contains the refresh tokens
    const cachedRefresh = Object.keys(  mockCache.getStore()).find((key) => {
      return key.includes(`{dmspr}:`)
    });
    expect(cachedRefresh).toBeFalsy();
    const cachedToken = Object.keys(  mockCache.getStore()).find((key) => {
      return key.includes(`{dmspbl}:`)
    });
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
    // Try a signout
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
    // First signin so we have cookies and a refresh token in the cache
    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    // Try a signout
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // First signin so we have cookies and a refresh token in the cache
    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];

    // Get the JTI from the token so we can add it to the blacklist
    const jwt = verifyAccessToken(context, accessToken);
      mockCache.adapter.set(`{dmspbl}:${jwt.jti}`, 'testing revocation', {});

    // Try a signout
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
  let mockUser: UserModel.User;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];

    mockUser = mockedUser;
    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
  });

  it('returns a 401 if the refresh token is not present', async () => {
    // Now try to refresh the access token
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // First signin so we have cookies and a refresh token in the cache
    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    const signinCookies = processResponseCookies(resp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];
    const refreshToken = signinCookies['dmspr'].split(';')[0];
    const jwt = verifyAccessToken(context, accessToken)

    // Make sure the mock cache contains the hashed version of the Refresh token
    const hashedToken = createHash('sha256')
      .update(`${refreshToken}${generalConfig.hashTokenSecret}`)
      .digest('hex');
    expect(await   mockCache.adapter.get(`{dmspr}:${jwt.jti}`)).toEqual(hashedToken);

    const errMock = jest.fn().mockImplementation(() => { throw new Error('testing') });
    (UserModel.User.findById as jest.Mock) = errMock;

    // Now try to refresh the access token
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // Force a super short TTL
    const originalTTL = generalConfig.jwtRefreshTTL;
    generalConfig.jwtRefreshTTL = 1;

    // First signin so we have cookies and a refresh token in the cache
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

    // Maybe a better way to do this. This is working though and doesn't take very long
    await new Promise(r => setTimeout(r, 1000));

    // Now try to refresh the access token
    const respRefresh = await request(app)
      .post('/apollo-refresh')
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', [`dmspt=${accessToken}`])
      .set('Cookie', [`dmspr=${refreshToken}`])
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({}));

    // Restore the original TTL
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // First signin so we have cookies and a refresh token in the cache
    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    const cookies = processResponseCookies(resp.headers);
    const accessToken = cookies['dmspt'].split(';')[0];
    const refreshToken = cookies['dmspr'].split(';')[0];
    const jwt = verifyAccessToken(context, accessToken)

    // Make sure the mock cache contains the hashed version of the Refresh token
    const hashedToken = createHash('sha256')
      .update(`${refreshToken}${generalConfig.hashTokenSecret}`)
      .digest('hex');
    expect(await   mockCache.adapter.get(`{dmspr}:${jwt.jti}`)).toEqual(hashedToken);

    (UserModel.User.findById as jest.Mock).mockResolvedValueOnce(registeredUser);

    // Wait a bit so the JTI for the new token will be different
    // Maybe a better way to do this. This is working though and doesn't take very long
    await new Promise(r => setTimeout(r, 1000));

    // Now try to refresh the access token
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
    const refreshedRefresh = refreshCookies['dmspr'].split(';')[0];

    // Access token should be new
    expect(refreshedAccess).not.toEqual(accessToken)
    // Refresh token should be the same
    expect(refreshedRefresh).toEqual(refreshToken)
  });
});

describe('protected endpoint access', () => {
  let mockUser: UserModel.User;
  let csrfToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCache.resetStore();
    context = await buildMockContextWithToken(logger, mockUser, mockCache);

    const resp = await request(app).get('/apollo-csrf');
    csrfToken = resp.headers['x-csrf-token'];

    mockUser = mockedUser;
    jest.spyOn(UserModel, 'User').mockReturnValue(mockUser);
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // First signin so we have cookies and a refresh token in the cache
    const resp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    // Try a signout
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // Force a super short TTL
    const originalTTL = generalConfig.jwtTTL;
    generalConfig.jwtTTL = 1;

    // First signin so we have cookies and a refresh token in the cache
    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];
    // Maybe a better way to do this. This is working though and doesn't take very long
    await new Promise(r => setTimeout(r, 1000));

    const protectedResp = await request(app)
      .post('/test-protected')
      .set('X-CSRF-Token', signinResp.headers['x-csrf-token'])
      .set('Cookie', [`dmspt=${accessToken}`])
      .send('testing unauthorized access');

    // Restore the original TTL
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
    (mockedUser.login as jest.Mock).mockResolvedValueOnce(registeredUser);

    // First signin so we have cookies and a refresh token in the cache
    const signinResp = await request(app)
      .post('/apollo-signin')
      .set('X-CSRF-Token', csrfToken)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: await mockUser.getEmail(context), password: mockUser.password }));

    expect(signinResp.statusCode).toEqual(200);
    const signinCookies = processResponseCookies(signinResp.headers);
    const accessToken = signinCookies['dmspt'].split(';')[0];

    // Get the JTI from the token so we can add it to the blacklist
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
