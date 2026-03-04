import 'jest-expect-message';
import { generalConfig } from "../../config/generalConfig";
import { normaliseHttpProtocol } from "../../utils/helpers";
import { LogInType, User, UserRole } from '../User';
import bcrypt from 'bcryptjs';
import casual from 'casual';
import { defaultLanguageId, supportedLanguages } from '../Language';
import { buildContext, buildMockContextWithToken } from '../../__mocks__/context';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { logger } from "../../logger";
import { UserEmail } from '../UserEmail';
import { PaginationType } from '../../types/general';
import {ProjectCollaborator, TemplateCollaborator} from "../Collaborator";

jest.mock('../../context.ts');
jest.mock('../UserEmail');

let mockQuery;
let mockUser;
let mockContext;

describe('constructor', () => {
  it('should set the expected properties', () => {
    const lang = supportedLanguages.find((entry) => { return entry.id !== defaultLanguageId });

    const props = {
      id: casual.integer(1, 99999),
      password: casual.password,
      affiliationId: casual.url,
      role: UserRole.ADMIN,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: normaliseHttpProtocol(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`),
      ssoId: casual.uuid,
      languageId: lang.id,
    }

    const user = new User(props);
    expect(user.id).toEqual(props.id);
    expect(user.password).toEqual(props.password);
    expect(user.affiliationId).toEqual(props.affiliationId);
    expect(user.givenName).toEqual(props.givenName);
    expect(user.surName).toEqual(props.surName);
    expect(user.orcid).toEqual(props.orcid);
    expect(user.ssoId).toEqual(props.ssoId);
    expect(user.role).toEqual(props.role);
    expect(user.languageId).toEqual(props.languageId);
  });

  it('should set the defaults properly', () => {
    const props = { password: casual.password, affiliationId: casual.url };
    const user = new User(props);
    expect(user.id).toBeFalsy();
    expect(user.password).toEqual(props.password);
    expect(user.affiliationId).toEqual(props.affiliationId);
    expect(user.givenName).toBeFalsy();
    expect(user.surName).toBeFalsy();
    expect(user.orcid).toBeFalsy();
    expect(user.role).toEqual(UserRole.RESEARCHER);
    expect(user.languageId).toEqual(defaultLanguageId);
    expect(user.last_sign_in).toBeFalsy();
    expect(user.last_sign_in_via).toBeFalsy();
    expect(user.failed_sign_in_attempts).toEqual(0);
    expect(user.notify_on_comment_added).toEqual(true);
    expect(user.notify_on_template_shared).toEqual(true);
    expect(user.notify_on_feedback_complete).toEqual(true);
    expect(user.notify_on_plan_shared).toEqual(true);
    expect(user.notify_on_plan_visibility_change).toEqual(true);
    expect(user.locked).toEqual(false);
    expect(user.active).toEqual(true);
  });

  it('should ignore unexpected properties', () => {
    const props = { password: casual.password };
    const user = new User({ ...props, test: 'blah' });
    expect(user.password).toEqual(props.password);
    expect(user['test']).toBeUndefined();
  });
});

describe('prepForSave standardizes the format of properties', () => {
  it('should properly format the properties', () => {
    const user = new User({
      givenName: ' Test ',
      surName: '  user  ',
      languageId: 'test',
      orcid: `${generalConfig.orcidBaseURL}0000-0000-0000-000X`,
    });
    user.prepForSave();
    expect(user.givenName).toEqual('Test');
    expect(user.surName).toEqual('User');
    expect(user.role).toEqual(UserRole.RESEARCHER);
    expect(user.languageId).toEqual(defaultLanguageId);
    expect(user.orcid).toEqual(normaliseHttpProtocol(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`));
  });
});

describe('prepForSave properly handles ORCIDs', () => {
  it('should null out invalid ORCIDs', () => {
    const user = new User({
      givenName: ' Test ',
      surName: '  user  ',
      languageId: 'test',
      orcid: '25t24g45g45g546gt',
    });
    user.prepForSave();
    expect(user.orcid).toBeNull();
  });

  it('should handle the ORCID URL with no protocol', () => {
    const user = new User({
      givenName: ' Test ',
      surName: '  user  ',
      languageId: 'test',
      orcid: `${generalConfig.orcidBaseURL.replace(/https?:\/\//, '')}0000-0000-0000-000X`,
    });
    user.prepForSave();
    expect(user.orcid).toEqual(normaliseHttpProtocol(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`));
  });

  it('should handle the ORCID ID without base URL', () => {
    const user = new User({
      givenName: ' Test ',
      surName: '  user  ',
      languageId: 'test',
      orcid: `0000-0000-0000-000X`,
    });
    user.prepForSave();
    expect(user.orcid).toEqual(normaliseHttpProtocol(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`));
  });
});

describe('validate a new User', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockUser = new User({
      password: 'abcd3Fgh!JklM_m0$',
      givenName: casual.first_name,
      surName: casual.last_name,
      affiliationId: casual.url,
      role: UserRole.RESEARCHER,
      createdById: casual.integer(1, 999),
      acceptedTerms: true,
    });

    mockContext = buildContext as jest.MockedFunction<typeof buildContext>;

    const mockSqlDataSource = (buildContext(logger, null, null)).dataSources.sqlDataSource;
    mockQuery = mockSqlDataSource.query as jest.MockedFunction<typeof mockSqlDataSource.query>;
  })

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when we have a new user with a valid password', async () => {
    expect(await mockUser.isValid()).toBe(true);
  });

  it('should return false when the password is missing', async () => {
    mockQuery.mockResolvedValueOnce(null);
    mockUser.password = null;
    expect(await mockUser.isValid()).toBe(false);
    expect(Object.keys(mockUser.errors).length).toBe(1);
    expect(mockUser.errors['password']).toBeTruthy();
  });

  it('should return false when we have a new user without an createdById', async () => {
    mockQuery.mockResolvedValueOnce(null);
    mockUser.createdById = null;
    expect(await mockUser.isValid()).toBe(false);
    expect(Object.keys(mockUser.errors).length).toBe(1);
    expect(mockUser.errors['createdById']).toBeTruthy();
  });

  it('should return false when we have a new user without a role', async () => {
    mockQuery.mockResolvedValueOnce(null);
    mockUser.role = null;
    expect(await mockUser.isValid()).toBe(false);
    expect(Object.keys(mockUser.errors).length).toBe(1);
    expect(mockUser.errors['role']).toBeTruthy();
  });
});

describe('Password validation', () => {
  it('should return true for a valid passwords', () => {
    expect(new User({ password: 'AbcdefgH1!' }).validatePassword()).toBe(true);
    expect(new User({ password: 'AbcdefgH1@#$%^&*-_+=?' }).validatePassword()).toBe(true);
    expect(new User({ password: 'Abcdef  gH1#' }).validatePassword()).toBe(true);
    expect(new User({ password: ' AbcdefgH1$' }).validatePassword()).toBe(true);
    expect(new User({ password: 'AbcdefgH1! ' }).validatePassword()).toBe(true);
  });

  it('should allow all of the approved special characters', () => {
    const chars = ['~', '`', '!', '@', '#', '$', '%', '^', '&', '*', '-', "_", '+', '=', '?', ' '];
    for (const char of chars) {
      const valid = new User({ password: `Abcd3Fgh1jkL${char}`}).validatePassword();
      expect(valid, `Failed when testing character ${char}`).toBe(true);
    }
  });

  it('should fail for a new user with a password that is too short', async () => {
    const user = new User({ password: 'abcde' });
    expect(user.validatePassword()).toBe(false);
    expect(Object.keys(user.errors).length === 1);
    expect(user.errors['password'].includes('Invalid password')).toBe(true);
  });

  it('should fail for a new user if the password does not contain at least 1 uppercase letter', async () => {
    const user = new User({ password: 'abcd3fgh1jk' });
    expect(user.validatePassword()).toBe(false);
    expect(Object.keys(user.errors).length === 1);
    expect(user.errors['password'].includes('Invalid password')).toBe(true);
  });


  it('should return error if password is missing', async () => {
    const user = new User({ password: null });
    expect(user.validatePassword()).toBe(false);
    expect(Object.keys(user.errors).length === 1);
    expect(user.errors['password'].includes('Invalid password')).toBe(true);
  });

  it('should fail for a new user if the password does not contain at least 1 lowercase letter', async () => {
    const user = new User({ password: 'ABCD3FGH1JKL' });
    expect(user.validatePassword()).toBe(false);
    expect(Object.keys(user.errors).length === 1);
    expect(user.errors['password'].includes('Invalid password')).toBe(true);
  });

  it('should fail for a new user if the password does not contain at least 1 number letter', async () => {
    const user = new User({ password: 'Abcd$Fgh#jkL' });
    expect(user.validatePassword()).toBe(false);
    expect(Object.keys(user.errors).length === 1);
    expect(user.errors['password'].includes('Invalid password')).toBe(true);
  });

  it('should fail for a new user if the password does not contain at least 1 special character', async () => {
    const user = new User({ password: 'Abcd3Fgh1jkL' });
    expect(user.validatePassword()).toBe(false);
    expect(Object.keys(user.errors).length === 1);
    expect(user.errors['password'].includes('Invalid password')).toBe(true);
  });

  it('should fail for a new user if it contains special characters that are not allowed', () => {
    const badChars = ['(', ')', '{', '[', '}', ']', '|', '\\', ':', ';', '"', "'", '<', ',', '>', '.', '/'];
    for (const char of badChars) {
      const valid = new User({ password: `Abcd3Fgh1jkL${char}`}).validatePassword();
      expect(valid, `Failed when testing character ${char}`).toBe(false);
    }
  });
});

describe('authCheck', () => {
  let bcryptCompare;

  beforeEach(() => {
    jest.resetAllMocks();

    mockUser = new User({
      password: 'abcd3Fgh!JklM_m0$',
      givenName: casual.first_name,
      surName: casual.last_name,
      affiliationId: casual.url,
      role: UserRole.RESEARCHER,
      createdById: casual.integer(1, 999),
      acceptedTerms: true,
    });

    mockContext = buildContext(logger, null, null);
    const mockSqlDataSource = mockContext.dataSources.sqlDataSource;
    mockQuery = mockSqlDataSource.query as jest.MockedFunction<typeof mockSqlDataSource.query>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('it returns null if there is no User for the specified email', async () => {
    const email = casual.email;
    const password = 'Abcd3Fgh1jkL$';
    (UserEmail.findByEmail as jest.Mock).mockResolvedValue([]);
    mockQuery.mockResolvedValueOnce([])
    expect(await User.authCheck('Testing authCheck', mockContext, email, password)).toBeFalsy();
    expect(mockContext.logger.debug).toHaveBeenCalledTimes(1);
  });

  it('it returns null if the password does not match', async () => {
    const email = casual.email;
    const password = 'Abcd3Fgh1jkL$';
    (UserEmail.findByEmail as jest.Mock).mockResolvedValue([
      new UserEmail({ userId: 12345, isPrimary: true, isConfirmed: true, email: email})
    ]);
    mockQuery.mockResolvedValueOnce([mockUser]);

    bcryptCompare = jest.fn().mockResolvedValue(false);
    (bcrypt.compare as jest.Mock) = bcryptCompare;

    expect(await User.authCheck('Testing authCheck', mockContext, email, password)).toBeFalsy();
    expect(mockContext.logger.debug).toHaveBeenCalledTimes(1);
  });

  it('it returns the user\'s id if the password matched', async () => {
    const email = 'test.email@example.com'
    const password = 'Abcd3Fgh1jkL$';
    mockUser.id = 12345;

    (UserEmail.findByEmail as jest.Mock).mockResolvedValueOnce([
      { userId: mockUser.id, isPrimary: true, isConfirmed: true, email: email }
    ]);

    const mockUserData = { ...mockUser }; // or Object.assign({}, mockUser)
    mockQuery.mockResolvedValueOnce([mockUserData]);

    // jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

    const bcryptCompare = jest.fn().mockResolvedValue(true);
    (bcrypt.compare as jest.Mock) = bcryptCompare;

    const result = await User.authCheck('Testing authCheck', mockContext, email, password);
    expect(result).toEqual(mockUser.id);
    expect(mockContext.logger.debug).toHaveBeenCalledTimes(2);
  });

  it('getName returns the user\'s full name', () => {
    mockUser.givenName = casual.first_name;
    mockUser.surName = casual.last_name;
    expect(mockUser.getName()).toEqual(`${mockUser.givenName} ${mockUser.surName}`);

    mockUser.givenName = null;
    mockUser.surName = casual.last_name;
    expect(mockUser.getName()).toEqual(`${mockUser.surName}`);

    mockUser.givenName = casual.first_name;
    mockUser.surName = null;
    expect(mockUser.getName()).toEqual(`${mockUser.givenName}`);

    mockUser.givenName = undefined;
    mockUser.surName = null;
    expect(mockUser.getName()).toEqual('');
  });
});

describe('recordLogIn', () => {
  let context;

  let user;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    user = new User({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      affiliationId: casual.url,
      password: casual.password,
      givenName: casual.first_name,
      surName: casual.last_name,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  })

  it('returns an error if the Section has no id', async () => {
    jest.spyOn(User, 'update').mockResolvedValueOnce(null);
    const result = await user.recordLogIn(context, getRandomEnumValue(LogInType));
    expect(result).toEqual(false);
  });

  it('updates the User last_sign_in fields', async () => {
    jest.spyOn(User, 'update').mockResolvedValueOnce(user);
    const result = await user.recordLogIn(context, getRandomEnumValue(LogInType));
    expect(result).toEqual(true);
  });
});

describe('login()', () => {
  let context;
  let mockAuthCheck;
  let mockUpdate;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockAuthCheck = jest.fn();
    (User.authCheck as jest.Mock) = mockAuthCheck;

    mockContext = buildContext as jest.MockedFunction<typeof buildContext>;
    const mockSqlDataSource = (buildContext(logger, null, null)).dataSources.sqlDataSource;
    mockQuery = mockSqlDataSource.query as jest.MockedFunction<typeof mockSqlDataSource.query>;

    mockUpdate = jest.fn().mockResolvedValue(true);
    (User.update as jest.Mock) = mockUpdate;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed if user exists and its password matches with encrypted one', async () => {
    const email = 'test.user@example.com';
    const user = new User({
      password: 'abcd3Fgh!JklM_m0$',
    });
    mockAuthCheck.mockReturnValue(123);
    mockQuery.mockResolvedValue([{ id: 123, password: user.password }]);

    const response = await user.login(context, email);
    expect(response).not.toBeNull();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledTimes(2);
    expect(context.logger.error).toHaveBeenCalledTimes(0);
  });

  it('should return an error when authCheck does not return a userId', async () => {
    mockAuthCheck.mockReturnValue(null);
    const email = 'test.user@example.com';
    const user = new User({ password: '@bcd3fGhijklmnop' });
    const response = await user.login(context, email);
    expect(response).toBe(null);
  });

  it('should return null when findEmail() throws an error', async () => {
    mockAuthCheck.mockImplementation(() => {
      throw new Error('Testing error handler');
    });
    const user = new User({ email: 'test.user@example.com', password: 'AbcdefgH1!' });
    const email = 'test.user@example.com';
    const response = await user.login(context, email);
    expect(response).toBeNull();
    expect(context.logger.error).toHaveBeenCalledTimes(1);
  });
});

describe('register()', () => {
  let context;

  const bcryptSalt = jest.fn().mockReturnValue('abc');
  (bcrypt.genSalt as jest.Mock) = bcryptSalt;

  const bcryptPassword = jest.fn().mockReturnValue('test.user@example.com');
  (bcrypt.hash as jest.Mock) = bcryptPassword;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    const mockSqlDataSource = (buildContext(logger, null, null)).dataSources.sqlDataSource;
    mockQuery = mockSqlDataSource.query as jest.MockedFunction<typeof mockSqlDataSource.query>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  })

  it('should not return null if user exists and its password matches with encrypted one', async () => {
    const email = 'test.user@example.com'
    const mockedUser = { id: 1, name: '@bcd3fGhijklmnop' };
    // First call to Mock mysql query from findByEmail()
    mockQuery.mockResolvedValueOnce([mockedUser, []]);
    // Second call to Mock mysql query from register()
    mockQuery.mockResolvedValueOnce({ id: 1 });
    // Third call to Mock mysql query from findById()
    mockQuery.mockResolvedValueOnce([mockedUser, []]);

    const user = new User({
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'simple',
      affiliationId: casual.url,
      acceptedTerms: true,
    });
    jest.spyOn(user, 'validatePassword').mockReturnValue(true);

    const response = await user.register(context, email);
    expect(response).not.toBeNull();
    expect(user.validatePassword).toHaveBeenCalledTimes(1);
  });

  it('should return user object with an error if they did not accept the terms', async () => {
    const email = 'test.user@example.com'
    const user = new User({
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'simple',
      affiliationId: casual.url,
    });
    mockQuery.mockResolvedValueOnce(user);
    const response = await user.register(context, email);
    expect(response).toBe(user);
    expect(response.errors['acceptedTerms']).toBeTruthy();
  });

  it('should return user object if there was an error creating user', async () => {
    const mockedUser = { id: 1, name: '@bcd3fGhijklmnop' };
    // First call to Mock mysql query from findByEmail()
    mockQuery.mockResolvedValueOnce([mockedUser, []]);
    // Second call to Mock mysql query from register()
    mockQuery.mockRejectedValueOnce('There was an error creating user');
    // Third call to Mock mysql query from findById()
    mockQuery.mockResolvedValueOnce([mockedUser, []]);

    const email = 'test.user@example.com'
    const user = new User({
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'simple',
      affiliationId: casual.url,
      acceptedTerms: true
    });

    const response = await user.register(context, email);
    expect(response).toBeInstanceOf(User);
    expect(Object.keys(response.errors).length > 0).toBe(true);
  });

  it('should return the user with errors if there are errors validating the user', async () => {
    const mockedUser = { id: 1, name: '@bcd3fGhijklmnop' };
    // First call to Mock mysql query from findByEmail()
    mockQuery.mockResolvedValueOnce([{}, []]);
    // Second call to Mock mysql query from register()
    mockQuery.mockRejectedValueOnce('There was an error creating user');
    // Third call to Mock mysql query from findById()
    mockQuery.mockResolvedValueOnce([mockedUser, []]);

    const email = 'test.user@example.com'
    const user = new User({
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'simple',
      acceptedTerms: true,
    });

    const response = await user.register(context, email);
    expect(response).toBeInstanceOf(User);
    expect(Object.keys(response.errors).length > 0).toBe(true);
  });

  it('should return the user with errors if the terms were not accepted', async () => {
    const email = 'test.user@example.com'
    const user = new User({
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'simple',
      acceptedTerms: false,
    });
    // First call to Mock mysql query from findByEmail()
    mockQuery.mockResolvedValueOnce([{}, []]);

    const response = await user.register(context, email);
    expect(response).toBeInstanceOf(User);
    expect(Object.keys(response.errors).length > 0).toBe(true);
  });

  it('should return the user if successfully created', async () => {
    const email = 'tester@example.com';
    const user = new User({
      id: 123,
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'Simple',
      affiliationId: casual.url,
      acceptedTerms: true,
    });

    // First call to Mock mysql query from findByEmail()
    jest.spyOn(UserEmail, "findByEmail").mockResolvedValue([]);
    // Second call to Mock mysql query from register()
    jest.spyOn(User, "query").mockResolvedValueOnce([{ insertId: 1 }]);
    // Third call to Mock mysql query from findById()
    jest.spyOn(User, "findById").mockResolvedValueOnce(user);
    // Fourth call to update the createdById and modifiedById
    jest.spyOn(User, "query").mockResolvedValueOnce([user]);
    // Fifth call to add the email
    mockQuery.mockResolvedValueOnce({ email });
    // Sixth call to fetch template collaborators
    jest.spyOn(TemplateCollaborator, "findByEmail").mockResolvedValueOnce([]);
    // Seventh call to fetch project collaborators
    jest.spyOn(ProjectCollaborator, "findByEmail").mockResolvedValueOnce([]);

    jest.spyOn(user, 'validatePassword').mockReturnValue(true);

    const response = await user.register(context, email);
    expect(response).not.toBeNull();
    expect(user.validatePassword).toHaveBeenCalledTimes(1);
  });

  it('should accept all template collaboration invites', async () => {
    const email = 'tester@example.com';
    const user = new User({
      id: 123,
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'Simple',
      affiliationId: casual.url,
      acceptedTerms: true,
    });
    const mockInviteUpdate = jest.fn().mockResolvedValue(true);
    const collabs = [new TemplateCollaborator({ email })];

    // First call to Mock mysql query from findByEmail()
    jest.spyOn(UserEmail, "findByEmail").mockResolvedValue([]);
    // Second call to Mock mysql query from register()
    jest.spyOn(User, "query").mockResolvedValueOnce([{ insertId: 1 }]);
    // Third call to Mock mysql query from findById()
    jest.spyOn(User, "findById").mockResolvedValueOnce(user);
    // Fourth call to update the createdById and modifiedById
    jest.spyOn(User, "query").mockResolvedValueOnce([user]);
    // Fifth call to add the email
    mockQuery.mockResolvedValueOnce({ email });
    // Sixth call to fetch template collaborators
    jest.spyOn(TemplateCollaborator, "findByEmail").mockResolvedValueOnce(collabs);
    // Seventh call to fetch project collaborators
    jest.spyOn(ProjectCollaborator, "findByEmail").mockResolvedValueOnce([]);

    jest.spyOn(user, 'validatePassword').mockReturnValue(true);
    jest.spyOn(collabs[0], 'update').mockImplementation(mockInviteUpdate);

    const response = await user.register(context, email);
    expect(response).not.toBeNull();
    expect(user.validatePassword).toHaveBeenCalledTimes(1);
    expect(mockInviteUpdate).toHaveBeenCalledTimes(1);
  });

  it('should accept all project collaboration invites', async () => {
    const email = 'tester@example.com';
    const user = new User({
      id: 123,
      password: '@bcd3fGhijklmnop',
      givenName: 'Test',
      surName: 'Simple',
      affiliationId: casual.url,
      acceptedTerms: true,
    });
    const mockInviteUpdate = jest.fn().mockResolvedValue(true);
    const collabs = [new ProjectCollaborator({ email })];

    // First call to Mock mysql query from findByEmail()
    jest.spyOn(UserEmail, "findByEmail").mockResolvedValue([]);
    // Second call to Mock mysql query from register()
    jest.spyOn(User, "query").mockResolvedValueOnce([{ insertId: 1 }]);
    // Third call to Mock mysql query from findById()
    jest.spyOn(User, "findById").mockResolvedValueOnce(user);
    // Fourth call to update the createdById and modifiedById
    jest.spyOn(User, "query").mockResolvedValueOnce([user]);
    // Fifth call to add the email
    mockQuery.mockResolvedValueOnce({ email });
    // Sixth call to fetch template collaborators
    jest.spyOn(TemplateCollaborator, "findByEmail").mockResolvedValueOnce([]);
    // Seventh call to fetch project collaborators
    jest.spyOn(ProjectCollaborator, "findByEmail").mockResolvedValueOnce(collabs);

    jest.spyOn(user, 'validatePassword').mockReturnValue(true);
    jest.spyOn(collabs[0], 'update').mockImplementation(mockInviteUpdate);

    const response = await user.register(context, email);
    expect(response).not.toBeNull();
    expect(user.validatePassword).toHaveBeenCalledTimes(1);
    expect(mockInviteUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('update', () => {
  let context;
  let updateQuery;
  let user;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);

    updateQuery = jest.fn();
    (User.update as jest.Mock) = updateQuery;

    user = new User({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      affiliationId: casual.url,
      password: 'Or1ginalPa$$2',
    })
  });

  it('returns the User without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await user.update(context);
    expect(result).toBeInstanceOf(User);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the User has no id', async () => {
    const localValidator = jest.fn();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    user.id = null;
    const result = await user.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated User', async () => {
    const localValidator = jest.fn();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn();
    (User.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValue(user);

    const result = await user.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(User);
  });

  it('prevents the password from being updated', async () => {
    const localValidator = jest.fn();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn();
    (User.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValue(user);

    user.password = 'N3wPa$$word1';
    const result = await user.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(User);
  });
});

describe('updatePassword', () => {
  let context;
  let updateQuery;
  let user;
  let oldPassword;
  let newPassword;

  let mockValidator;
  let mockAuthCheck;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    oldPassword = 'Test0ldP@ssw1';
    newPassword = 'TestN3wP@ssw2';

    user = new User({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      affiliationId: casual.url,
    });

    mockAuthCheck = jest.fn();
    (User.authCheck as jest.Mock) = mockAuthCheck;

    mockValidator = jest.fn();
    (user.validatePassword as jest.Mock) = mockValidator;

    updateQuery = jest.fn().mockResolvedValue(user);
    (User.update as jest.Mock) = updateQuery;
  });

  afterEach(() => {
    jest.clearAllMocks();
  })

  it('returns the User without errors if it is valid and we could update the password', async () => {
    mockAuthCheck.mockResolvedValueOnce(true);
    mockValidator.mockReturnValue(true);
    const mockFindById = jest.fn().mockResolvedValue(user);
    (User.findById as jest.Mock) = mockFindById;

    expect(await user.updatePassword(context, oldPassword, newPassword)).toBe(user);
    expect(mockAuthCheck).toHaveBeenCalledTimes(1);
    expect(mockValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
  });

  it('returns the User with errors if new password is invalid', async () => {
    mockAuthCheck.mockResolvedValueOnce(true);
    mockValidator.mockReturnValueOnce(false);

    const result = await user.updatePassword(context, oldPassword, newPassword);
    expect(result).toBeInstanceOf(User);
    expect(mockAuthCheck).toHaveBeenCalledTimes(1);
    expect(mockValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it('returns null if the oldPassword is invalid', async () => {
    mockAuthCheck.mockResolvedValueOnce(false);

    expect(await user.updatePassword(context, oldPassword, newPassword)).toBe(null);
    expect(mockAuthCheck).toHaveBeenCalledTimes(1);
    expect(mockValidator).not.toHaveBeenCalled();
    expect(updateQuery).not.toHaveBeenCalled();
  });
});

describe('getEmail', () => {
  let user;
  let context;

  beforeEach(async () => {
    jest.resetAllMocks();
    context = await buildMockContextWithToken(logger);
    user = new User({
      id: 123,
      password: casual.password,
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.RESEARCHER,
      acceptedTerms: true,
      languageId: defaultLanguageId,
    });
  });

  it('should return the primary email if it exists', async () => {
    const mockEmail = 'test.user@example.com';
    (UserEmail.findPrimaryByUserId as jest.Mock).mockResolvedValue({ email: mockEmail });
    const result = await user.getEmail(context);
    expect(result).toBe(mockEmail);
    expect(UserEmail.findPrimaryByUserId).toHaveBeenCalledWith('User.getEmail', context, user.id);
  });

  it('should return null if no primary email exists', async () => {
    (UserEmail.findPrimaryByUserId as jest.Mock).mockResolvedValue(null);
    const result = await user.getEmail(context);
    expect(result).toBeNull();
    expect(UserEmail.findPrimaryByUserId).toHaveBeenCalledWith('User.getEmail', context, user.id);
  });
});

describe('findByAffiliationId', () => {
  let context;
  let mockPaginatedResults;

  beforeEach(async () => {
    jest.resetAllMocks();
    context = await buildMockContextWithToken(logger);
    mockPaginatedResults = {
      items: [
        new User({
          id: 1,
          affiliationId: 'affil-1',
          givenName: 'Alice',
          surName: 'Smith',
          password: 'password',
          role: UserRole.RESEARCHER,
          languageId: defaultLanguageId,
          acceptedTerms: true,
        }),
        new User({
          id: 2,
          affiliationId: 'affil-1',
          givenName: 'Bob',
          surName: 'Jones',
          password: 'password',
          role: UserRole.RESEARCHER,
          languageId: defaultLanguageId,
          acceptedTerms: true,
        })
      ],
      totalCount: 2,
      hasNextPage: false,
      hasPreviousPage: false,
      pageInfo: {}
    };
    jest.spyOn(User, 'queryWithPagination').mockResolvedValue(mockPaginatedResults);
  });

  it('should return users for a given affiliationId and term', async () => {
    const affiliationId = 'affil-1';
    const term = 'Alice';
    const options = { type: PaginationType.OFFSET, sortField: 'u.surName', sortDir: 'ASC' };
    const result = await User.findByAffiliationId('testRef', context, affiliationId, term, options);
    expect(User.queryWithPagination).toHaveBeenCalled();
    expect(result.items.length).toBe(2);
    expect(result.items[0].givenName).toBe('Alice');
    expect(result.items[1].givenName).toBe('Bob');
  });

  it('should handle empty results', async () => {
    (User.queryWithPagination as jest.Mock).mockResolvedValueOnce({ items: [], limit: 10, totalCount: 0, hasNextPage: false, hasPreviousPage: false });
    const options = { type: PaginationType.OFFSET };
    const result = await User.findByAffiliationId('testRef', context, 'affil-2', '', options);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});

describe('findByEmail', () => {
  const originalQuery = User.findById;
  const originalEmailQuery = UserEmail.findByEmail;

  let localQuery;
  let emailQuery;
  let context;
  let user;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    emailQuery = jest.fn();
    (User.findById as jest.Mock) = localQuery;
    (UserEmail.findByEmail as jest.Mock) = emailQuery;

    context = await buildMockContextWithToken(logger);

    user = new User({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    User.findById = originalQuery;
    UserEmail.findByEmail = originalEmailQuery;
  });

  it('should call query with correct params and return the user', async () => {
    const email = casual.email;
    emailQuery.mockResolvedValueOnce([{ userId: user.id }]);
    localQuery.mockResolvedValueOnce(user);
    const result = await User.findByEmail('Testing', context, email);
    expect(emailQuery).toHaveBeenCalledTimes(1);
    expect(emailQuery).toHaveBeenLastCalledWith('Testing', context, email);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith('Testing', context, user.id);
    expect(result).toEqual(user);
  });

  it('should return null if it finds no users', async () => {
    const email = casual.email;
    emailQuery.mockResolvedValueOnce([]);
    const result = await User.findByEmail('Testing', context, email);
    expect(emailQuery).toHaveBeenCalledTimes(1);
    expect(emailQuery).toHaveBeenLastCalledWith('Testing', context, email);
    expect(localQuery).not.toHaveBeenCalled();
    expect(result).toEqual(null);
  });
});

describe('findById', () => {
  const originalQuery = User.query;

  let localQuery;
  let context;
  let user;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (User.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    user = new User({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    User.query = originalQuery;
  });

  it('should call query with correct params and return the user', async () => {
    localQuery.mockResolvedValueOnce([user]);
    const id = casual.integer(1, 9);
    const result = await User.findById('Testing', context, id);
    const expectedSql = 'SELECT * FROM users WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Testing')
    expect(result).toEqual(user);
  });

  it('should return null if it finds no users', async () => {
    localQuery.mockResolvedValueOnce(null);
    const id = casual.integer(1, 9);
    const result = await User.findById('Testing', context, id);
    expect(result).toEqual(null);
  });
});

describe('findByOrcid', () => {
  const originalQuery = User.query;

  let localQuery;
  let context;
  let user;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (User.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    user = new User({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    User.query = originalQuery;
  });

  it('should call query with correct params and return the user', async () => {
    localQuery.mockResolvedValueOnce([user]);
    const orcid = casual.url;
    const result = await User.findByOrcid('Testing', context, orcid);
    const expectedSql = 'SELECT * FROM users WHERE orcid = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [orcid], 'Testing')
    expect(result).toEqual(user);
  });

  it('should return null if it finds no users', async () => {
    localQuery.mockResolvedValueOnce([]);
    const orcid = casual.url;
    const result = await User.findByOrcid('Testing', context, orcid);
    expect(result).toEqual(null);
  });
});
