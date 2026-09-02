/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import casual from 'casual';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// --- datasources/mysql.js ---
jest.unstable_mockModule('../../datasources/mysql.js', () => ({
  __esModule: true,
  MySQLConnection: jest.fn().mockImplementation(() => ({
    pool: null,
    query: jest.fn(),
    withTransaction: jest.fn(),
  })),
}));

// --- config/awsConfig.js ---
const actualAwsConfig = await import('../../config/awsConfig.js');
jest.unstable_mockModule('../../config/awsConfig.js', () => ({
  ...actualAwsConfig,
  awsConfig: {
    opensearchServerless: { endpoint: 'http://localhost:9200' },
    ses: {
      endpoint: 'http://localhost:9210',
      port: 465,
      accessKey: 'test-access-key',
      accessSecret: 'test-access-secret',
    },
  },
}));

const actualOpenSearch = await import('../../datasources/openSearch.js');
jest.unstable_mockModule('../../datasources/openSearch.js', () => ({
  ...actualOpenSearch,
  OpenSearch: jest.fn(),
}));

// --- authService.js ---
// projectService.js under test calls isAdmin/isSuperAdmin as real gating
// logic — mocked here so individual tests can control the result
// deterministically. These are the SAME jest.fn()s the dynamically-imported
// `isAdmin`/`isSuperAdmin` bindings further down resolve to — there's no
// separate reassignment step needed (and none is possible: they're `const`
// bindings from a dynamic import, immutable at runtime).
const mockIsSuperAdmin = jest.fn<(...args: any[]) => Promise<boolean>>();
const mockIsAdmin = jest.fn<(...args: any[]) => Promise<boolean>>();
jest.unstable_mockModule('../authService.js', () => ({
  isSuperAdmin: mockIsSuperAdmin,
  isAdmin: mockIsAdmin,
}));

// --- services/emailService.js ---
// Not imported directly by projectService.js, but ProjectCollaborator.create()
// sends an invitation email internally — mocked so setCurrentUserAsProjectOwner's
// tests don't trigger a real email send.
const mockSendProjectCollaboratorsCommentsAddedEmail = jest.fn<(...args: any[]) => Promise<any>>();
const mockSendFeedbackRequestEmail = jest.fn<(...args: any[]) => Promise<any>>();
const mockSendFeedbackCompleteEmail = jest.fn<(...args: any[]) => Promise<any>>();

const actualEmailService = await import('../../services/emailService.js');
jest.unstable_mockModule('../../services/emailService.js', () => ({
  ...actualEmailService,
  sendProjectCollaboratorsCommentsAddedEmail: mockSendProjectCollaboratorsCommentsAddedEmail,
  sendFeedbackRequestEmail: mockSendFeedbackRequestEmail,
  sendFeedbackCompleteEmail: mockSendFeedbackCompleteEmail,
}));

// --- planService.js ---
// Retained for parity with the original CJS suite. projectService.js's
// current source doesn't appear to import planService.js directly, so this
// may be vestigial — but it's harmless either way since the real module's
// exports are spread first.
const mockCreatePlanVersion = jest.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(true);
const mockSyncWithDMPHub = jest.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(true);
const actualPlanService = await import('../planService.js');
jest.unstable_mockModule('../planService.js', () => ({
  ...actualPlanService,
  createPlanVersion: mockCreatePlanVersion,
  syncWithDMPHub: mockSyncWithDMPHub,
}));

import type { MyContext } from '../../context.js';

const { logger } = await import("../../logger.js");
const { buildMockContextWithToken, mockUser } = await import("../../__mocks__/context.js");
const { Project } = await import('../../models/Project.js');
const {
  ensureDefaultProjectContact,
  hasPermissionOnProject,
  setCurrentUserAsProjectOwner,
  isProjectReadOnlyForCurrentUser,
} = await import('../projectService.js');
const { ProjectCollaborator, ProjectCollaboratorAccessLevel } = await import('../../models/Collaborator.js');
const { User, UserRole } = await import('../../models/User.js');
const { ProjectMember } = await import('../../models/Member.js');
const { MemberRole } = await import('../../models/MemberRole.js');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { isAdmin, isSuperAdmin } = await import("../authService.js");

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('hasPermissionOnProject', () => {
  let project: InstanceType<typeof Project>;
  let mockQuery: ReturnType<typeof jest.fn>;
  let mockCollaboratorQuery: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    mockQuery = jest.fn<(...args: any[]) => any>();
    context.dataSources.sqlDataSource = {
      query: mockQuery
    };
    context = await buildMockContextWithToken(logger);

    mockCollaboratorQuery = jest.spyOn(ProjectCollaborator, 'findByProjectId');

    project = new Project({
      id: casual.integer(1, 999),
      title: casual.sentence,
      createdById: casual.integer(1, 9999),
    });
  });

  it('returns true if the current user is a Super Admin', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(true);

    expect(await hasPermissionOnProject(context, project)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsAdmin).toHaveBeenCalledTimes(0);
    expect(mockQuery).toHaveBeenCalledTimes(0);
    expect(mockCollaboratorQuery).toHaveBeenCalledTimes(0);
  });

  it('returns true if the current user\'s id is the same as the project\'s owner', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(false);

    context.token = { id: project.createdById };
    expect(await hasPermissionOnProject(context, project)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsAdmin).toHaveBeenCalledTimes(0);
    expect(mockQuery).toHaveBeenCalledTimes(0);
    expect(mockCollaboratorQuery).toHaveBeenCalledTimes(0);
  });

  it('returns true if the current user\'s is an Admin and the project\'s owner are the same org', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(false);
    mockIsAdmin.mockResolvedValueOnce(true);
    context.token.id = casual.integer(1, 9999);
    jest.spyOn(User, 'findById').mockResolvedValueOnce(new User({ affiliationId: context.token.affiliationId }));
    expect(await hasPermissionOnProject(context, project)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsAdmin).toHaveBeenCalledTimes(1);
    expect(User.findById).toHaveBeenCalledTimes(1);
    expect(mockCollaboratorQuery).toHaveBeenCalledTimes(0);
  });

  it('returns true if the current user\'s is a collaborator on the project', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(false);
    mockIsAdmin.mockResolvedValueOnce(false);
    context.token = { id: casual.integer(1, 9999) };
    mockQuery.mockResolvedValueOnce({ affiliationId: context.token.affiliationId });
    mockCollaboratorQuery.mockResolvedValueOnce([
      { userId: context.token.id, accessLevel: ProjectCollaboratorAccessLevel.EDIT }
    ]);
    expect(await hasPermissionOnProject(context, project)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsAdmin).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(0);
    expect(mockCollaboratorQuery).toHaveBeenCalledTimes(1);
  });

  it('returns false when the user does not have permission', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(false);
    mockIsAdmin.mockResolvedValueOnce(false);
    mockCollaboratorQuery.mockResolvedValueOnce([]);
    context.token = { id: casual.integer(1, 9999) };
    expect(await hasPermissionOnProject(context, project)).toBe(false)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsAdmin).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(0);
    expect(mockCollaboratorQuery).toHaveBeenCalledTimes(1);
  });

  it('returns false if user has EDIT but PRIMARY is required', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(false);
    mockIsAdmin.mockResolvedValueOnce(false);
    context.token = { id: casual.integer(1, 9999) };
    mockCollaboratorQuery.mockResolvedValueOnce([
      { userId: context.token.id, accessLevel: ProjectCollaboratorAccessLevel.EDIT }
    ]);
    expect(await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.PRIMARY)).toBe(false);
  });

  it('returns true if user has PRIMARY and PRIMARY is required', async () => {
    mockIsSuperAdmin.mockResolvedValueOnce(false);
    mockIsAdmin.mockResolvedValueOnce(false);
    context.token = { id: casual.integer(1, 9999) };
    mockCollaboratorQuery.mockResolvedValueOnce([
      { userId: context.token.id, accessLevel: ProjectCollaboratorAccessLevel.PRIMARY }
    ]);
    expect(await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.PRIMARY)).toBe(true);
  });
});

describe('setCurrentUserAsProjectOwner', () => {
  let context: MyContext;
  let project: InstanceType<typeof Project>;
  let user: InstanceType<typeof User>;

  let originalInsert: typeof ProjectCollaborator.insert;
  let originalFindByProject: typeof ProjectCollaborator.findByProjectIdAndEmail;
  let originalFindById: typeof ProjectCollaborator.findById;
  let originalProjectById: typeof Project.findById;
  let originalUserById: typeof User.findById;
  let originalUserByEmail: typeof User.findByEmail;

  beforeEach(async () => {
    jest.clearAllMocks();

    user = mockUser();
    context = await buildMockContextWithToken(logger, user)

    project = new Project({
      id: casual.integer(1, 999),
      title: casual.sentence
    });

    originalInsert = ProjectCollaborator.insert;
    originalFindByProject = ProjectCollaborator.findByProjectIdAndEmail;
    originalFindById = ProjectCollaborator.findById;
    originalUserByEmail = User.findByEmail;
    originalUserById = User.findById;
    originalProjectById = Project.findById;

    jest.spyOn(ProjectCollaborator, 'findByProjectIdAndEmail').mockResolvedValue(null);
    jest.spyOn(User, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(User, 'findById').mockResolvedValue(user);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);
    jest.spyOn(ProjectCollaborator, 'insert');
    jest.spyOn(ProjectCollaborator, 'findById');
  });

  afterEach(() => {
    ProjectCollaborator.insert = originalInsert;
    ProjectCollaborator.findByProjectIdAndEmail = originalFindByProject;
    ProjectCollaborator.findById = originalFindById;
    Project.findById = originalProjectById;
    User.findById = originalUserById;
    User.findByEmail = originalUserByEmail;
  })

  it('returns false if there is no token', async () => {
    const originalToken = await context.token;
    context.token = undefined;
    expect(await setCurrentUserAsProjectOwner(context, project.id)).toBe(false)
    context.token = originalToken;
  });

  it('returns false if the collaborator record could not be saved', async () => {
    const msg = 'Test error';
    jest.spyOn(ProjectCollaborator, 'findByProjectIdAndEmail').mockImplementation(() => {
      throw new Error(msg);
    });
    await expect(setCurrentUserAsProjectOwner(context, project.id)).rejects.toThrow(msg);
    expect(ProjectCollaborator.findByProjectIdAndEmail).toHaveBeenCalledTimes(1);
    expect(User.findByEmail).toHaveBeenCalledTimes(0);
  });

  it('returns true if the collaborator was created', async () => {
    const newId = casual.integer(1, 9999);
    const collaborator = new ProjectCollaborator({
      projectId: project.id,
      email: context.token.email,
      accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
      invitedById: context.token.id,
    });
    jest.spyOn(ProjectCollaborator, 'insert').mockResolvedValue(newId);
    jest.spyOn(ProjectCollaborator, 'findById').mockResolvedValue(
      new ProjectCollaborator({
        ...collaborator,
        id: newId,
      })
    );

    expect(await setCurrentUserAsProjectOwner(context, project.id)).toBe(true)
    expect(ProjectCollaborator.findByProjectIdAndEmail).toHaveBeenCalledTimes(1);
    expect(User.findByEmail).toHaveBeenCalledTimes(1);
    expect(ProjectCollaborator.insert).toHaveBeenCalledWith(
      context,
      'projectCollaborators',
      {
        ...collaborator,
        userId: undefined,
      },
      'ProjectCollaborator.create'
    );
    expect(User.findById).toHaveBeenCalledTimes(1);
  });
});

describe('ensureDefaultProjectContact', () => {
  let context: MyContext;
  let project: InstanceType<typeof Project>;
  let user: InstanceType<typeof User>;
  let defaultRole: InstanceType<typeof MemberRole>;

  let originalDefaultRole: typeof MemberRole.defaultRole;
  let originalFindByProjectMemberId: typeof MemberRole.findByProjectMemberId;

  beforeEach(async () => {
    jest.clearAllMocks();

    originalDefaultRole = MemberRole.defaultRole;
    originalFindByProjectMemberId = MemberRole.findByProjectMemberId;

    defaultRole = new MemberRole({
      id: casual.integer(1, 999),
      label: 'Test',
    });
    jest.spyOn(MemberRole, 'defaultRole').mockResolvedValue(defaultRole);
    jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([defaultRole]);

    user = mockUser();
    context = await buildMockContextWithToken(logger, user);

    project = new Project({
      id: casual.integer(1, 999),
      title: casual.sentence
    });
  });

  afterEach(() => {
    MemberRole.defaultRole = originalDefaultRole;
    MemberRole.findByProjectMemberId = originalFindByProjectMemberId;
  })

  it('sets default primary contact', async () => {
    const originalFindPrimaryContact = ProjectMember.findPrimaryContact;
    const originalInsert = ProjectMember.insert;
    const originalFind = ProjectMember.findById;
    const originalFindById = User.findById;
    const originalFindByEmail = ProjectMember.findByProjectAndEmail;
    const originalFindByName = ProjectMember.findByProjectAndName;

    const newId = casual.integer(1, 9999);
    const newMember = new ProjectMember({
      ...user,
      email: await user.getEmail(context),
      projectId: project.id,
      isPrimaryContact: true,
      memberRoleIds: [defaultRole.id],
      memberRoles: [defaultRole],
    });
    jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(null);
    jest.spyOn(ProjectMember, 'findByProjectAndEmail').mockResolvedValue(null);
    jest.spyOn(ProjectMember, 'findByProjectAndName').mockResolvedValue(null);
    jest.spyOn(ProjectMember, 'insert').mockResolvedValue(newId);
    jest.spyOn(ProjectMember, 'findById').mockResolvedValue(newMember);
    jest.spyOn(User, 'findById').mockResolvedValue(user);

    expect(await ensureDefaultProjectContact(context, project)).toBe(true);
    expect(ProjectMember.insert).toHaveBeenCalledWith(
      context,
      'projectMembers',
      newMember,
      'ProjectMember.create',
      ['memberRoles']
    );
    ProjectMember.findPrimaryContact = originalFindPrimaryContact;
    ProjectMember.findById = originalFind;
    ProjectMember.findByProjectAndEmail = originalFindByEmail;
    ProjectMember.findByProjectAndName = originalFindByName;
    User.findById = originalFindById;
    ProjectMember.insert = originalInsert;
  });

  it('returns false if the project is missing', async () => {
    expect(await ensureDefaultProjectContact(context, null)).toBe(false);
  });

  it('returns false if there was a problem creating the ProjectMember', async () => {
    const originalFindPrimaryContact = ProjectMember.findPrimaryContact;
    jest.spyOn(ProjectMember, 'findPrimaryContact').mockImplementation(() => {
      throw new Error('test error');
    });

    await expect(ensureDefaultProjectContact(context, project)).rejects.toThrow('test error');
    ProjectMember.findPrimaryContact = originalFindPrimaryContact;
  });

  it('returns false if the owner does not exist', async () => {
    const originalFindPrimaryContact = ProjectMember.findPrimaryContact;
    const originalFindById = User.findById;
    jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(null);
    jest.spyOn(User, 'findById').mockReturnValue(null);

    expect(await ensureDefaultProjectContact(context, project)).toBe(false);
    ProjectMember.findPrimaryContact = originalFindPrimaryContact;
    User.findById = originalFindById;
  });

  it('returns true if the project already has a primary contact', async () => {
    const originalFindPrimaryContact = ProjectMember.findPrimaryContact;
    const current = new ProjectMember({
      projectId: project.id,
      email: casual.email,
    });
    jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(current);

    expect(await ensureDefaultProjectContact(context, project)).toBe(true);
    ProjectMember.findPrimaryContact = originalFindPrimaryContact;
  });
});

describe('isProjectReadOnlyForCurrentUser', () => {
  let project: InstanceType<typeof Project>;
  let mockFindByUserIdAndProjectId: ReturnType<typeof jest.spyOn>;
  let mockFindPrimaryUserByProjectId: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    jest.clearAllMocks();

    context = await buildMockContextWithToken(logger);

    project = new Project({
      id: casual.integer(1, 999),
      title: casual.sentence,
    });

    mockFindByUserIdAndProjectId = jest.spyOn(ProjectCollaborator, 'findByUserIdAndProjectId');
    mockFindPrimaryUserByProjectId = jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId');
  });

  afterEach(() => {
    mockFindByUserIdAndProjectId.mockRestore();
    mockFindPrimaryUserByProjectId.mockRestore();
  });

  it('returns false (not read-only) if caller has OWN access level', async () => {
    mockFindByUserIdAndProjectId.mockResolvedValueOnce({
      accessLevel: ProjectCollaboratorAccessLevel.OWN,
    });

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(false);
    expect(mockFindByUserIdAndProjectId).toHaveBeenCalledTimes(1);
    expect(mockFindPrimaryUserByProjectId).toHaveBeenCalledTimes(0);
  });

  it('returns false (not read-only) if caller has PRIMARY access level', async () => {
    mockFindByUserIdAndProjectId.mockResolvedValueOnce({
      accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
    });

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(false);
    expect(mockFindByUserIdAndProjectId).toHaveBeenCalledTimes(1);
    expect(mockFindPrimaryUserByProjectId).toHaveBeenCalledTimes(0);
  });

  it('returns true (read-only) if caller has EDIT access level', async () => {
    mockFindByUserIdAndProjectId.mockResolvedValueOnce({
      accessLevel: ProjectCollaboratorAccessLevel.EDIT,
    });

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(true);
    expect(mockFindByUserIdAndProjectId).toHaveBeenCalledTimes(1);
  });

  it('returns true (read-only) if caller is a SUPERADMIN without write access', async () => {
    mockFindByUserIdAndProjectId.mockResolvedValueOnce({
      accessLevel: ProjectCollaboratorAccessLevel.EDIT,
    });
    context.token = { ...context.token, role: UserRole.SUPERADMIN };

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(true);
    expect(mockFindPrimaryUserByProjectId).toHaveBeenCalledTimes(0);
  });

  it('returns true (read-only) if caller is an ADMIN with same affiliation as primary collaborator', async () => {
    const sharedAffiliationId = casual.integer(1, 999);
    mockFindByUserIdAndProjectId.mockResolvedValueOnce({
      accessLevel: ProjectCollaboratorAccessLevel.EDIT,
    });
    mockFindPrimaryUserByProjectId.mockResolvedValueOnce({
      affiliationId: sharedAffiliationId,
    });
    context.token = {
      ...context.token,
      role: UserRole.ADMIN,
      affiliationId: sharedAffiliationId,
    };

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(true);
    expect(mockFindPrimaryUserByProjectId).toHaveBeenCalledTimes(1);
  });

  it('returns true (read-only) if caller is an ADMIN with a different affiliation than the primary collaborator', async () => {
    mockFindByUserIdAndProjectId.mockResolvedValueOnce({
      accessLevel: ProjectCollaboratorAccessLevel.EDIT,
    });
    mockFindPrimaryUserByProjectId.mockResolvedValueOnce({
      affiliationId: casual.integer(1, 499),
    });
    context.token = {
      ...context.token,
      role: UserRole.ADMIN,
      affiliationId: casual.integer(500, 999),
    };

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(true);
    expect(mockFindPrimaryUserByProjectId).toHaveBeenCalledTimes(1);
  });

  it('returns true (read-only) if caller has no collaborator record', async () => {
    mockFindByUserIdAndProjectId.mockResolvedValueOnce(null);

    const result = await isProjectReadOnlyForCurrentUser('test', context, project);

    expect(result).toBe(true);
    expect(mockFindByUserIdAndProjectId).toHaveBeenCalledTimes(1);
  });
});