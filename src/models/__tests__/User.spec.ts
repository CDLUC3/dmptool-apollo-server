import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

const mockGenSalt = jest.fn<() => Promise<string>>();
const mockHash = jest.fn<() => Promise<string>>();
const mockCompare = jest.fn<() => Promise<boolean>>();

jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    genSalt: mockGenSalt,
    hash: mockHash,
    compare: mockCompare,
  },
}));

import type { UserRole as UserRoleType } from '../User.js';

type SearchQueryWithPaginationFn = (
  reference: string,
  context: unknown,
  whereFilters: string[],
  groupBy: unknown,
  values: string[],
  opts: Record<string, unknown>,
) => Promise<{
  items: InstanceType<typeof User>[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageInfo: Record<string, unknown>;
}>;

//Dynamic imports AFTER all mocks are registered
const { buildContext, buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { generalConfig } = await import("../../config/generalConfig.js");

const { normaliseHttpProtocol } = await import("../../utils/helpers.js");
const { User, UserRole } = await import('../User.js');
const { defaultLanguageId, supportedLanguages } = await import('../Language.js');
const { UserEmail } = await import('../UserEmail.js');
const { PaginationType } = await import('../../types/general.js');

let mockQuery;
let mockUser;

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
    const localValidator = jest.fn<() => Promise<boolean>>();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await user.update(context);
    expect(result).toBeInstanceOf(User);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the User has no id', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    user.id = null;
    const result = await user.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated User', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof User>>>();
    (User.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValue(user);

    const result = await user.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(User);
  });

  it('prevents the password from being updated', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (user.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof User>>>();
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
    const mockFindPrimaryByUserId = jest.fn<() => Promise<InstanceType<typeof UserEmail> | null>>();
    (UserEmail.findPrimaryByUserId as unknown as jest.Mock) = mockFindPrimaryByUserId;
    mockFindPrimaryByUserId.mockResolvedValue({ email: mockEmail } as InstanceType<typeof UserEmail>);

    const result = await user.getEmail(context);
    expect(result).toBe(mockEmail);
    expect(UserEmail.findPrimaryByUserId).toHaveBeenCalledWith('User.getEmail', context, user.id);
  });

  it('should return null if no primary email exists', async () => {
    const mockFindPrimaryByUserId = jest.fn<() => Promise<InstanceType<typeof UserEmail> | null>>();
    (UserEmail.findPrimaryByUserId as unknown as jest.Mock) = mockFindPrimaryByUserId;
    mockFindPrimaryByUserId.mockResolvedValue(null);
    const result = await user.getEmail(context);
    expect(result).toBeNull();
    expect(UserEmail.findPrimaryByUserId).toHaveBeenCalledWith('User.getEmail', context, user.id);
  });
});

describe('findByAffiliationId', () => {
  let context;
  let mockPaginatedResults;
  let mockQueryWithPagination: jest.Mock<() => Promise<{
    items: InstanceType<typeof User>[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    pageInfo: Record<string, unknown>;
  }>>;

  const makeUser = (id: number, role: UserRoleType) =>
    new User({
      id,
      affiliationId: 'affil-1',
      givenName: id === 1 ? 'Alice' : 'Bob',
      surName: id === 1 ? 'Smith' : 'Jones',
      password: 'password',
      role,
      languageId: defaultLanguageId,
      acceptedTerms: true,
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    context = await buildMockContextWithToken(logger);
    mockPaginatedResults = {
      items: [makeUser(1, UserRole.RESEARCHER), makeUser(2, UserRole.RESEARCHER)],
      totalCount: 2,
      hasNextPage: false,
      hasPreviousPage: false,
      pageInfo: {},
    };
    mockQueryWithPagination = jest.spyOn(User, 'queryWithPagination').mockResolvedValue(mockPaginatedResults) as unknown as jest.Mock<() => Promise<{
      items: InstanceType<typeof User>[];
      totalCount: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      pageInfo: Record<string, unknown>;
    }>>;

  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns users for a given affiliationId without role filter', async () => {
    const result = await User.findByAffiliationId(
      'testRef', context, 'affil-1', 'Alice',
      { type: PaginationType.OFFSET, sortField: 'u.surName', sortDir: 'ASC' },
    );

    expect(mockQueryWithPagination).toHaveBeenCalledTimes(1);
    expect(result.items.length).toBe(2);
    expect(result.items[0].givenName).toBe('Alice');
    expect(result.items[1].givenName).toBe('Bob');


    const [, , whereFilters, , values] = (User.queryWithPagination as jest.Mock).mock.calls[0] as [
      unknown, string, string[], string, string[]
    ];

    expect(whereFilters).toContain('u.affiliationId = ?');
    expect(whereFilters.every((f: string) => !f.includes('u.role = ?'))).toBe(true);
    expect(values).toContain('affil-1');
  });

  it('filters by role when role is provided', async () => {
    mockQueryWithPagination.mockResolvedValueOnce({
      items: [makeUser(3, UserRole.ADMIN)],
      totalCount: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      pageInfo: {},
    });

    const result = await User.findByAffiliationId(
      'testRef', context, 'affil-1', '',
      { type: PaginationType.OFFSET },
      UserRole.ADMIN,
    );

    const [, , whereFilters, , values] = (mockQueryWithPagination as jest.Mock).mock.calls[0];
    expect(whereFilters).toContain('u.role = ?');
    expect(values).toContain(UserRole.ADMIN);
    expect(result.items.length).toBe(1);
  });

  it('does not add role filter when role is undefined', async () => {
    await User.findByAffiliationId(
      'testRef', context, 'affil-1', '',
      { type: PaginationType.OFFSET },
    );

    const [, , whereFilters, ,] = (mockQueryWithPagination as jest.Mock).mock.calls[0] as [
      unknown, string, string[], string, string[]
    ];
    expect(whereFilters.every((f: string) => !f.includes('u.role = ?'))).toBe(true);
  });

  it('passes the search term through to the query values', async () => {
    await User.findByAffiliationId(
      'testRef', context, 'affil-1', 'alice',
      { type: PaginationType.OFFSET },
    );

    const [, , whereFilters, , values] = (mockQueryWithPagination as jest.Mock).mock.calls[0] as [
      unknown, string, string[], string, string[]
    ];
    expect(whereFilters.some((f: string) => f.includes('LOWER(u.givenName) LIKE ?'))).toBe(true);
    expect(values.some((v: string) => v.includes('alice'))).toBe(true);
  });

  it('uses OFFSET pagination options when type is OFFSET', async () => {
    await User.findByAffiliationId(
      'testRef', context, 'affil-1', '',
      { type: PaginationType.OFFSET, sortField: 'u.surName', sortDir: 'ASC' },
    );

    const [, , , , , opts] = (mockQueryWithPagination as jest.Mock).mock.calls[0] as [
      unknown, string, string[], string, string[], Record<string, unknown>
    ]
    expect(opts.availableSortFields).toBeDefined();
    expect(opts.availableSortFields).toContain('u.surName');
    expect(opts.sortField).toBe('u.surName');
    expect(opts.sortDir).toBe('ASC');
  });

  it('uses CURSOR pagination options when type is CURSOR', async () => {
    await User.findByAffiliationId(
      'testRef', context, 'affil-1', '',
      { type: PaginationType.CURSOR },
    );

    const [, , , , , opts] = (mockQueryWithPagination as jest.Mock).mock.calls[0] as [
      unknown, string, string[], string, string[], Record<string, unknown>
    ]
    expect(opts.cursorField).toBeDefined();
    expect(opts.availableSortFields).toBeUndefined();
  });

  it('applies default sort field and direction when none are provided', async () => {
    await User.findByAffiliationId(
      'testRef', context, 'affil-1', '',
      { type: PaginationType.OFFSET },
    );

    const [, , , , , opts] = (mockQueryWithPagination as jest.Mock).mock.calls[0] as [
      unknown, string, string[], string, string[], Record<string, unknown>
    ]
    expect(opts.sortField).toBe('u.created');
    expect(opts.sortDir).toBe('DESC');
  });

  it('handles empty results', async () => {
    mockQueryWithPagination.mockResolvedValueOnce({
      items: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false, pageInfo: {},
    });

    const result = await User.findByAffiliationId(
      'testRef', context, 'affil-99', '',
      { type: PaginationType.OFFSET },
    );

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
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Testing');
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
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [orcid], 'Testing');
    expect(result).toEqual(user);
  });

  it('should return null if it finds no users', async () => {
    localQuery.mockResolvedValueOnce([]);
    const orcid = casual.url;
    const result = await User.findByOrcid('Testing', context, orcid);
    expect(result).toEqual(null);
  });
});

describe('search', () => {
  let context;
  let mockPaginatedResults;
  let mockQueryWithPagination: jest.Mock<SearchQueryWithPaginationFn>;

  const makeUser = (id: number, role: UserRoleType) =>
    new User({
      id,
      affiliationId: casual.url,
      givenName: id === 1 ? 'Alice' : 'Bob',
      surName: id === 1 ? 'Smith' : 'Jones',
      password: 'password',
      role,
      languageId: defaultLanguageId,
      acceptedTerms: true,
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    context = await buildMockContextWithToken(logger);

    mockPaginatedResults = {
      items: [makeUser(1, UserRole.RESEARCHER), makeUser(2, UserRole.RESEARCHER)],
      totalCount: 2,
      hasNextPage: false,
      hasPreviousPage: false,
      pageInfo: {},
    };

    mockQueryWithPagination = jest.spyOn(User, 'queryWithPagination').mockResolvedValue(mockPaginatedResults) as unknown as jest.Mock<SearchQueryWithPaginationFn>;

  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  type SearchCallArgs = [
    unknown, unknown, string[], unknown, string[], Record<string, unknown>
  ];

  it('calls queryWithPagination and returns matching users', async () => {
    const result = await User.search('testRef', context, 'alice', { type: PaginationType.OFFSET });

    expect(mockQueryWithPagination).toHaveBeenCalledTimes(1);
    expect(result.items.length).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it('passes the search term into whereFilters and values', async () => {
    await User.search('testRef', context, 'alice', { type: PaginationType.OFFSET });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const whereFilters = callArgs[2];
    const values = callArgs[4];

    expect(whereFilters.some((f: string) => f.includes('LOWER(u.givenName) LIKE ?'))).toBe(true);
    expect(whereFilters.some((f: string) => f.includes('LOWER(a.searchName) LIKE ?'))).toBe(true);
    expect(values.every((v: string) => v === '%alice%')).toBe(true);
    expect(values.length).toBe(5);
  });

  it('adds role filter to whereFilters and values when role is provided', async () => {
    await User.search('testRef', context, '', { type: PaginationType.OFFSET }, UserRole.ADMIN);

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const whereFilters = callArgs[2];
    const values = callArgs[4];

    expect(whereFilters).toContain('u.role = ?');
    expect(values).toContain(UserRole.ADMIN);
  });

  it('does not add role filter when role is not provided', async () => {
    await User.search('testRef', context, '', { type: PaginationType.OFFSET });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const whereFilters = callArgs[2];

    expect(whereFilters.every((f: string) => !f.includes('u.role = ?'))).toBe(true);
  });

  it('includes both term and role filters when both are provided', async () => {
    await User.search('testRef', context, 'alice', { type: PaginationType.OFFSET }, UserRole.ADMIN);

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const whereFilters = callArgs[2];
    const values = callArgs[4];

    expect(whereFilters.some((f: string) => f.includes('LOWER(u.givenName) LIKE ?'))).toBe(true);
    expect(whereFilters).toContain('u.role = ?');
    expect(values).toContain('%alice%');
    expect(values).toContain(UserRole.ADMIN);
  });

  it('uses OFFSET pagination and sets availableSortFields', async () => {
    await User.search('testRef', context, '', { type: PaginationType.OFFSET, sortField: 'u.surName', sortDir: 'ASC' });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const opts = callArgs[5];

    expect(opts.availableSortFields).toBeDefined();
    expect(opts.availableSortFields).toContain('u.surName');
    expect(opts.availableSortFields).toContain('a.name');
    expect(opts.cursorField).toBeUndefined();
    expect(opts.sortField).toBe('u.surName');
    expect(opts.sortDir).toBe('ASC');
  });

  it('uses CURSOR pagination and sets cursorField', async () => {
    await User.search('testRef', context, '', { type: PaginationType.CURSOR });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const opts = callArgs[5];

    expect(opts.cursorField).toBe('CONCAT(ue.email, u.id)');
    expect(opts.availableSortFields).toBeUndefined();
  });

  it('applies default sort field and direction when none are provided', async () => {
    await User.search('testRef', context, '', { type: PaginationType.OFFSET });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const opts = callArgs[5];

    expect(opts.sortField).toBe('u.created');
    expect(opts.sortDir).toBe('DESC');
  });

  it('sets countField to u.id', async () => {
    await User.search('testRef', context, '', { type: PaginationType.OFFSET });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const opts = callArgs[5];

    expect(opts.countField).toBe('u.id');
  });

  it('returns empty results when no users match', async () => {
    mockQueryWithPagination.mockResolvedValueOnce({
      items: [],
      totalCount: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      pageInfo: {},
    });

    const result = await User.search('testRef', context, 'nobody', { type: PaginationType.OFFSET });

    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('handles an empty search term without adding whereFilters', async () => {
    await User.search('testRef', context, '', { type: PaginationType.OFFSET });

    const callArgs = mockQueryWithPagination.mock.calls[0] as SearchCallArgs;
    const whereFilters = callArgs[2];

    expect(whereFilters.some((f: string) => f.includes('LOWER(u.givenName) LIKE ?'))).toBe(true);
  });
});
