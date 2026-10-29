/* eslint-disable @typescript-eslint/no-explicit-any */

import casual from "casual";
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// Same architecture as feedback.test.ts:
//  - Model classes (Guidance, GuidanceGroup, Plan, Project) are REAL,
//    spied per-test via jest.spyOn — never `jest.fn()`/`as jest.Mock` casts.
//    jest.spyOn infers its types from the real method signature, so no
//    generic-typing gymnastics are needed at the call sites.
//  - Plain function-export services (guidanceService, projectService,
//    authService) get a full jest.unstable_mockModule replacement, but every
//    mock function is declared up front with an explicit generic
//    (`jest.fn<(...args: any[]) => Promise<any>>()`), never a bare
//    `jest.fn()` — that's what was collapsing to `never` and cascading into
//    the "argument not assignable to never" errors, including the one that
//    looked like it was about `casual`.
// ---------------------------------------------------------------------------
const mockHasPermissionOnGuidanceGroup = jest.fn<(...args: any[]) => Promise<boolean>>();
const mockMarkGuidanceGroupAsDirty = jest.fn<(...args: any[]) => Promise<void>>();
const mockGetGuidanceSourcesForPlan = jest.fn<(...args: any[]) => Promise<any>>();
const mockHasPermissionOnProject = jest.fn<(...args: any[]) => Promise<boolean>>();

const actualGuidanceService = await import('../../services/guidanceService.js');
jest.unstable_mockModule('../../services/guidanceService.js', () => ({
  ...actualGuidanceService,
  hasPermissionOnGuidanceGroup: mockHasPermissionOnGuidanceGroup,
  markGuidanceGroupAsDirty: mockMarkGuidanceGroupAsDirty,
  getGuidanceSourcesForPlan: mockGetGuidanceSourcesForPlan,
}));

const actualProjectService = await import('../../services/projectService.js');
jest.unstable_mockModule('../../services/projectService.js', () => ({
  ...actualProjectService,
  hasPermissionOnProject: mockHasPermissionOnProject,
}));

// authService: only `authenticatedResolver` (the HOF wrapping guidance
// resolvers with an auth check) is replaced with a pass-through. This has to
// be registered before resolver.js is imported, since resolver.js applies
// authenticatedResolver once, at module-load time, to build the wrapped
// resolver map — resetting/reassigning this mock later has no effect on
// resolvers that were already wrapped.
const mockAuthenticatedResolver = jest.fn(
  (_ref: any, _level: any, resolver: any) => resolver
);
const actualAuthService = await import('../../services/authService.js');
jest.unstable_mockModule('../../services/authService.js', () => ({
  ...actualAuthService,
  authenticatedResolver: mockAuthenticatedResolver,
}));

// ---------------------------------------------------------------------------
// Everything else is imported for real, after the mocks above are registered.
// ---------------------------------------------------------------------------
const { ApolloServer } = await import("@apollo/server");
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { User, UserRole } = await import("../../models/User.js");
const { Guidance } = await import('../../models/Guidance.js');
const { GuidanceGroup } = await import('../../models/GuidanceGroup.js');
const { Plan } = await import('../../models/Plan.js');
const { Project } = await import('../../models/Project.js');


// ---------------------------------------------------------------------------
// jest.spyOn ties each mock to the REAL method's signature, so TypeScript now
// enforces the real return types (Guidance, Guidance[], GuidanceGroup, Plan,
// Project) on every .mockResolvedValue(...) call. Our test fixtures are
// plain objects with just the fields the resolvers/GraphQL layer actually
// read, not full class instances (they're missing base-model methods like
// isValid/prepForSave/create/update). These small helpers cast a plain
// fixture to the real instance type at the point it's handed to a mock,
// without needing an `as unknown as X` at every call site.
// ---------------------------------------------------------------------------
type GuidanceInstance = InstanceType<typeof Guidance>;
type GuidanceGroupInstance = InstanceType<typeof GuidanceGroup>;
type PlanInstance = InstanceType<typeof Plan>;
type ProjectInstance = InstanceType<typeof Project>;

function asGuidance(value: any): GuidanceInstance {
  return value as GuidanceInstance;
}
function asGuidanceList(value: any[]): GuidanceInstance[] {
  return value as GuidanceInstance[];
}
function asGuidanceGroup(value: any): GuidanceGroupInstance {
  return value as GuidanceGroupInstance;
}
function asPlan(value: any): PlanInstance {
  return value as PlanInstance;
}
function asProject(value: any): ProjectInstance {
  return value as ProjectInstance;
}

let testServer: InstanceType<typeof ApolloServer>;
let affiliationId: string;
let adminToken: any;
let researcherToken: any;
let query: string;

async function executeQuery(query: string, variables: any, token: any): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;

  researcherToken = await mockToken();
  researcherToken.affiliationId = affiliationId;
  researcherToken.role = UserRole.RESEARCHER;

  // Safe, restrictive defaults for every model/service method the suite
  // touches. Individual tests override these with their own jest.spyOn(...)
  // calls as needed. Establishing all of them here (rather than only in the
  // tests that care) avoids order-dependent flakiness: once a method is
  // spied once in this file it stays spied (jest.resetAllMocks() clears the
  // implementation but doesn't restore the real method), so later tests
  // that don't re-spy it would otherwise silently get `undefined` instead
  // of real behavior.
  jest.spyOn(Guidance, 'findById').mockResolvedValue(null);
  jest.spyOn(Guidance, 'findByGuidanceGroupId').mockResolvedValue([]);
  jest.spyOn(Guidance.prototype, 'create').mockResolvedValue(asGuidance({}));
  jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(null);
  jest.spyOn(Plan, 'findById').mockResolvedValue(null);
  jest.spyOn(Project, 'findById').mockResolvedValue(null);

  mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);
  mockMarkGuidanceGroupAsDirty.mockResolvedValue(undefined);
  mockGetGuidanceSourcesForPlan.mockResolvedValue([]);
  mockHasPermissionOnProject.mockResolvedValue(false);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('guidance resolvers', () => {
  let user: any;

  beforeEach(async () => {
    user = new User({
      id: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.ADMIN,
      affiliationId,
    });
    jest.spyOn(user, 'getEmail').mockResolvedValue(casual.email);
  });

  // ============================================================================
  // Query: guidanceByGroup
  // ============================================================================
  describe('Query.guidanceByGroup', () => {
    beforeEach(() => {
      query = `
        query guidanceByGroup($guidanceGroupId: Int!) {
          guidanceByGroup(guidanceGroupId: $guidanceGroupId) {
            id
            guidanceGroupId
            guidanceText
            tagId
          }
        }
      `;
    });

    it('should return guidance items when admin has permission', async () => {
      const mockGuidanceItems = [
        { id: 1, guidanceGroupId: 10, guidanceText: 'Test guidance 1', tagId: 1 },
        { id: 2, guidanceGroupId: 10, guidanceText: 'Test guidance 2', tagId: 2 },
      ];

      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      jest.spyOn(Guidance, 'findByGuidanceGroupId').mockResolvedValue(asGuidanceList(mockGuidanceItems));

      const result = await executeQuery(query, { guidanceGroupId: 10 }, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.guidanceByGroup).toHaveLength(2);
      expect(result.body.singleResult.data.guidanceByGroup[0].id).toEqual(1);
      expect(result.body.singleResult.data.guidanceByGroup[1].id).toEqual(2);
      expect(Guidance.findByGuidanceGroupId).toHaveBeenCalledWith(
        'guidanceByGroup resolver',
        expect.any(Object),
        10
      );
    });

    it('should return guidance items for non-admin when guidance group is published', async () => {
      const mockGuidanceItems = [
        { id: 1, guidanceGroupId: 10, guidanceText: 'Published guidance', tagId: 1 },
      ];
      const mockGuidanceGroup = { id: 10, affiliationId, latestPublishedDate: '2025-01-01' };

      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);
      jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(asGuidanceGroup(mockGuidanceGroup));
      jest.spyOn(Guidance, 'findByGuidanceGroupId').mockResolvedValue(asGuidanceList(mockGuidanceItems));

      const result = await executeQuery(query, { guidanceGroupId: 10 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.guidanceByGroup).toHaveLength(1);
      expect(result.body.singleResult.data.guidanceByGroup[0].guidanceText).toEqual('Published guidance');
    });

    it('should return Forbidden when non-admin and guidance group is not published', async () => {
      const mockGuidanceGroup = {
        id: 10,
        affiliationId,
        latestPublishedDate: null,
        latestPublishedVersionId: null,
      };

      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);
      jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(asGuidanceGroup(mockGuidanceGroup));

      const result = await executeQuery(query, { guidanceGroupId: 10 }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });

  // ============================================================================
  // Query: guidance
  // ============================================================================
  describe('Query.guidance', () => {
    beforeEach(() => {
      query = `
        query guidance($guidanceId: Int!) {
          guidance(guidanceId: $guidanceId) {
            id
            guidanceGroupId
            guidanceText
            tagId
          }
        }
      `;
    });

    it('should return guidance when admin has permission', async () => {
      const mockGuidanceItem = { id: 5, guidanceGroupId: 10, guidanceText: 'Test guidance', tagId: 1 };
      const mockGuidanceGroup = { id: 10, affiliationId, latestPublishedDate: '2025-01-01' };

      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockGuidanceItem));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(asGuidanceGroup(mockGuidanceGroup));

      const result = await executeQuery(query, { guidanceId: 5 }, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.guidance.id).toEqual(5);
      expect(result.body.singleResult.data.guidance.guidanceText).toEqual('Test guidance');
    });

    it('should return NotFound when admin has permission but guidance does not exist', async () => {
      jest.spyOn(Guidance, 'findById').mockResolvedValue(null);
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(asGuidanceGroup({ id: 10, affiliationId }));

      const result = await executeQuery(query, { guidanceId: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Guidance not found');
    });

    it('should return guidance for non-admin when guidance group is published', async () => {
      const mockGuidanceItem = { id: 5, guidanceGroupId: 10, guidanceText: 'Public guidance', tagId: 1 };
      const mockGuidanceGroup = { id: 10, affiliationId, latestPublishedDate: '2025-01-01' };

      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockGuidanceItem));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);
      jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(asGuidanceGroup(mockGuidanceGroup));

      const result = await executeQuery(query, { guidanceId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.guidance.id).toEqual(5);
    });

    it('should return Forbidden for non-admin when guidance group is not published', async () => {
      const mockGuidanceItem = { id: 5, guidanceGroupId: 10, guidanceText: 'Unpublished', tagId: 1 };
      const mockGuidanceGroup = {
        id: 10,
        affiliationId,
        latestPublishedDate: null,
        latestPublishedVersionId: null,
      };

      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockGuidanceItem));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);
      jest.spyOn(GuidanceGroup, 'findById').mockResolvedValue(asGuidanceGroup(mockGuidanceGroup));

      const result = await executeQuery(query, { guidanceId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });

  // ============================================================================
  // Query: guidanceSourcesForPlan
  // ============================================================================
  describe('Query.guidanceSourcesForPlan', () => {
    beforeEach(() => {
      query = `
        query guidanceSourcesForPlan($planId: Int!, $versionedSectionId: Int, $versionedQuestionId: Int, $customSectionId: Int, $customQuestionId: Int) {
          guidanceSourcesForPlan(planId: $planId, versionedSectionId: $versionedSectionId, versionedQuestionId: $versionedQuestionId, customSectionId: $customSectionId, customQuestionId: $customQuestionId) {
            id
            type
            label
            shortName
            orgURI
            hasGuidance
            items {
              id
              title
              guidanceText
            }
          }
        }
      `;
    });

    it('should return guidance sources when user has project permission', async () => {
      const mockPlan = { id: 1, projectId: 100 };
      const mockProject = { id: 100 };
      const mockSources = [
        {
          id: 'source-1',
          type: 'BEST_PRACTICE',
          label: 'DMP Tool Best Practices',
          shortName: 'DMP Tool',
          orgURI: 'https://dmptool.org',
          hasGuidance: true,
          items: [{ id: 1, title: 'Data Storage', guidanceText: 'Store data securely' }],
        },
      ];

      jest.spyOn(Plan, 'findById').mockResolvedValue(asPlan(mockPlan));
      jest.spyOn(Project, 'findById').mockResolvedValue(asProject(mockProject));
      mockHasPermissionOnProject.mockResolvedValue(true);
      mockGetGuidanceSourcesForPlan.mockResolvedValue(mockSources);

      const result = await executeQuery(
        query,
        { planId: 1, versionedSectionId: 5, versionedQuestionId: 10 },
        researcherToken
      );

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.guidanceSourcesForPlan).toHaveLength(1);
      expect(result.body.singleResult.data.guidanceSourcesForPlan[0].id).toEqual('source-1');
      expect(result.body.singleResult.data.guidanceSourcesForPlan[0].type).toEqual('BEST_PRACTICE');
      expect(result.body.singleResult.data.guidanceSourcesForPlan[0].items[0].guidanceText).toEqual('Store data securely');
      expect(mockGetGuidanceSourcesForPlan).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        5,
        10,
        undefined,
        undefined
      );
    });

    it('should return NotFound when plan does not exist', async () => {
      jest.spyOn(Plan, 'findById').mockResolvedValue(null);

      const result = await executeQuery(query, { planId: 999 }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Plan with id 999 not found');
    });

    it('should return Forbidden when user does not have permission on project', async () => {
      const mockPlan = { id: 1, projectId: 100 };
      const mockProject = { id: 100 };

      jest.spyOn(Plan, 'findById').mockResolvedValue(asPlan(mockPlan));
      jest.spyOn(Project, 'findById').mockResolvedValue(asProject(mockProject));
      mockHasPermissionOnProject.mockResolvedValue(false);

      const result = await executeQuery(query, { planId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should call getGuidanceSourcesForPlan with customSectionId when provided', async () => {
      const mockPlan = { id: 1, projectId: 100 };
      const mockProject = { id: 100 };

      jest.spyOn(Plan, 'findById').mockResolvedValue(asPlan(mockPlan));
      jest.spyOn(Project, 'findById').mockResolvedValue(asProject(mockProject));
      mockHasPermissionOnProject.mockResolvedValue(true);
      mockGetGuidanceSourcesForPlan.mockResolvedValue([]);

      await executeQuery(
        query,
        { planId: 1, customSectionId: 7 },
        researcherToken
      );

      expect(mockGetGuidanceSourcesForPlan).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        undefined,
        undefined,
        7,
        undefined
      );
    });

    it('should call getGuidanceSourcesForPlan with customQuestionId when provided', async () => {
      const mockPlan = { id: 1, projectId: 100 };
      const mockProject = { id: 100 };

      jest.spyOn(Plan, 'findById').mockResolvedValue(asPlan(mockPlan));
      jest.spyOn(Project, 'findById').mockResolvedValue(asProject(mockProject));
      mockHasPermissionOnProject.mockResolvedValue(true);
      mockGetGuidanceSourcesForPlan.mockResolvedValue([]);

      await executeQuery(
        query,
        { planId: 1, versionedSectionId: 5, customQuestionId: 42 },
        researcherToken
      );

      expect(mockGetGuidanceSourcesForPlan).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        5,
        undefined,
        undefined,
        42
      );
    });
  });

  // ============================================================================
  // Mutation: addGuidance
  // ============================================================================
  describe('Mutation.addGuidance', () => {
    beforeEach(() => {
      query = `
        mutation addGuidance($input: AddGuidanceInput!) {
          addGuidance(input: $input) {
            id
            guidanceGroupId
            guidanceText
            tagId
            errors {
              general
            }
          }
        }
      `;
    });

    it('should create guidance when admin has permission', async () => {
      const mockCreated = { id: 99, guidanceGroupId: 10, guidanceText: 'New guidance', tagId: 2 };

      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      jest.spyOn(Guidance.prototype, 'create').mockResolvedValue(asGuidance(mockCreated));
      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockCreated));
      mockMarkGuidanceGroupAsDirty.mockResolvedValue(undefined);

      const vars = { input: { guidanceGroupId: 10, guidanceText: 'New guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.addGuidance.id).toEqual(99);
      expect(result.body.singleResult.data.addGuidance.guidanceText).toEqual('New guidance');
      expect(mockMarkGuidanceGroupAsDirty).toHaveBeenCalledWith(expect.any(Object), 10);
    });

    it('should return Forbidden when admin does not have permission', async () => {
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);

      const vars = { input: { guidanceGroupId: 10, guidanceText: 'New guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should return error when guidance creation fails', async () => {
      // Force create() to fail; the real Guidance constructor and addError()
      // run for real, so the resolver's own error-handling path (calling
      // guidance.addError('general', ...) after a failed create) populates
      // `errors` exactly as it would in production.
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      jest.spyOn(Guidance.prototype, 'create').mockResolvedValue(asGuidance({ id: null, errors: {} }));

      const vars = { input: { guidanceGroupId: 10, guidanceText: 'New guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.addGuidance.errors.general).toEqual('Unable to create the guidance');
    });
  });

  // ============================================================================
  // Mutation: updateGuidance
  // ============================================================================
  describe('Mutation.updateGuidance', () => {
    beforeEach(() => {
      query = `
        mutation updateGuidance($input: UpdateGuidanceInput!) {
          updateGuidance(input: $input) {
            id
            guidanceGroupId
            guidanceText
            tagId
            errors {
              general
            }
          }
        }
      `;
    });

    it('should update guidance when admin has permission', async () => {
      const mockGuidance = {
        id: 5,
        guidanceGroupId: 10,
        guidanceText: 'Old guidance',
        tagId: 1,
        errors: {},
        hasErrors: () => false,
        update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: 5 }),
      };
      const mockUpdated = { id: 5, guidanceGroupId: 10, guidanceText: 'Updated guidance', tagId: 2 };

      jest.spyOn(Guidance, 'findById')
        .mockResolvedValueOnce(asGuidance(mockGuidance))
        .mockResolvedValueOnce(asGuidance(mockUpdated));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      mockMarkGuidanceGroupAsDirty.mockResolvedValue(undefined);

      const vars = { input: { guidanceId: 5, guidanceText: 'Updated guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateGuidance.id).toEqual(5);
      expect(result.body.singleResult.data.updateGuidance.guidanceText).toEqual('Updated guidance');
      expect(mockMarkGuidanceGroupAsDirty).toHaveBeenCalledWith(expect.any(Object), 10);
    });

    it('should return NotFound when guidance does not exist', async () => {
      jest.spyOn(Guidance, 'findById').mockResolvedValue(null);
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);

      const vars = { input: { guidanceId: 999, guidanceText: 'Updated', tagId: 1 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Guidance not found');
    });

    it('should return Forbidden when admin does not have permission', async () => {
      const mockGuidance = { id: 5, guidanceGroupId: 10 };

      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockGuidance));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);

      const vars = { input: { guidanceId: 5, guidanceText: 'Updated', tagId: 1 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });

  // ============================================================================
  // Mutation: removeGuidance
  // ============================================================================
  describe('Mutation.removeGuidance', () => {
    beforeEach(() => {
      query = `
        mutation removeGuidance($guidanceId: Int!) {
          removeGuidance(guidanceId: $guidanceId) {
            id
            guidanceGroupId
            guidanceText
            errors {
              general
            }
          }
        }
      `;
    });

    it('should delete guidance when admin has permission', async () => {
      const mockDeleted = { id: 5, guidanceGroupId: 10, guidanceText: 'To be deleted' };
      const mockGuidance = {
        id: 5,
        guidanceGroupId: 10,
        guidanceText: 'To be deleted',
        errors: {},
        hasErrors: () => false,
        delete: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(mockDeleted),
      };

      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockGuidance));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);
      mockMarkGuidanceGroupAsDirty.mockResolvedValue(undefined);

      const result = await executeQuery(query, { guidanceId: 5 }, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.removeGuidance.id).toEqual(5);
      expect(mockMarkGuidanceGroupAsDirty).toHaveBeenCalledWith(expect.any(Object), 10);
    });

    it('should return NotFound when guidance does not exist', async () => {
      jest.spyOn(Guidance, 'findById').mockResolvedValue(null);
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(true);

      const result = await executeQuery(query, { guidanceId: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Guidance not found');
    });

    it('should return Forbidden when admin does not have permission', async () => {
      const mockGuidance = { id: 5, guidanceGroupId: 10 };

      jest.spyOn(Guidance, 'findById').mockResolvedValue(asGuidance(mockGuidance));
      mockHasPermissionOnGuidanceGroup.mockResolvedValue(false);

      const result = await executeQuery(query, { guidanceId: 5 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });
});