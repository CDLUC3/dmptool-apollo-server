import casual from "casual";

// Mock the authenticatedResolver HOF before importing resolvers
jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
}));

import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';

import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { Guidance } from '../../models/Guidance';
import { GuidanceGroup } from '../../models/GuidanceGroup';
import { Plan } from '../../models/Plan';
import { Project } from '../../models/Project';
import { User, UserRole } from "../../models/User";
import {
  hasPermissionOnGuidanceGroup,
  markGuidanceGroupAsDirty,
  getGuidanceSourcesForPlan,
} from '../../services/guidanceService';
import { hasPermissionOnProject } from '../../services/projectService';
import { buildContext, mockToken } from "../../__mocks__/context";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

jest.mock('../../models/Guidance');
jest.mock('../../models/GuidanceGroup');
jest.mock('../../models/Plan', () => ({
  Plan: { findById: jest.fn() },
}));
jest.mock('../../models/Project', () => ({
  Project: { findById: jest.fn() },
}));
jest.mock('../../services/guidanceService');
jest.mock('../../services/projectService');

let testServer: ApolloServer;
let affiliationId: string;
let adminToken: JWTAccessToken;
let researcherToken: JWTAccessToken;
let query: string;

async function executeQuery(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any,
  token: JWTAccessToken
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
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
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('guidance resolvers', () => {
  let user: User;

  beforeEach(async () => {
    user = new User({
      id: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.ADMIN,
      affiliationId,
    });
    (user.getEmail as jest.Mock) = jest.fn().mockResolvedValue(casual.email);
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

      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      (Guidance.findByGuidanceGroupId as jest.Mock).mockResolvedValue(mockGuidanceItems);

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

      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);
      (GuidanceGroup.findById as jest.Mock).mockResolvedValue(mockGuidanceGroup);
      (Guidance.findByGuidanceGroupId as jest.Mock).mockResolvedValue(mockGuidanceItems);

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

      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);
      (GuidanceGroup.findById as jest.Mock).mockResolvedValue(mockGuidanceGroup);

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

      (Guidance.findById as jest.Mock).mockResolvedValue(mockGuidanceItem);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      (GuidanceGroup.findById as jest.Mock).mockResolvedValue(mockGuidanceGroup);

      const result = await executeQuery(query, { guidanceId: 5 }, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.guidance.id).toEqual(5);
      expect(result.body.singleResult.data.guidance.guidanceText).toEqual('Test guidance');
    });

    it('should return NotFound when admin has permission but guidance does not exist', async () => {
      (Guidance.findById as jest.Mock).mockResolvedValue(null);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ id: 10, affiliationId });

      const result = await executeQuery(query, { guidanceId: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Guidance not found');
    });

    it('should return guidance for non-admin when guidance group is published', async () => {
      const mockGuidanceItem = { id: 5, guidanceGroupId: 10, guidanceText: 'Public guidance', tagId: 1 };
      const mockGuidanceGroup = { id: 10, affiliationId, latestPublishedDate: '2025-01-01' };

      (Guidance.findById as jest.Mock).mockResolvedValue(mockGuidanceItem);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);
      (GuidanceGroup.findById as jest.Mock).mockResolvedValue(mockGuidanceGroup);

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

      (Guidance.findById as jest.Mock).mockResolvedValue(mockGuidanceItem);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);
      (GuidanceGroup.findById as jest.Mock).mockResolvedValue(mockGuidanceGroup);

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
        query guidanceSourcesForPlan($planId: Int!, $versionedSectionId: Int, $versionedQuestionId: Int) {
          guidanceSourcesForPlan(planId: $planId, versionedSectionId: $versionedSectionId, versionedQuestionId: $versionedQuestionId) {
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

      (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);
      (hasPermissionOnProject as jest.Mock).mockResolvedValue(true);
      (getGuidanceSourcesForPlan as jest.Mock).mockResolvedValue(mockSources);

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
      expect(getGuidanceSourcesForPlan).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        5,
        10,
        undefined
      );
    });

    it('should return NotFound when plan does not exist', async () => {
      (Plan.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { planId: 999 }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Plan with id 999 not found');
    });

    it('should return Forbidden when user does not have permission on project', async () => {
      const mockPlan = { id: 1, projectId: 100 };
      const mockProject = { id: 100 };

      (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);
      (hasPermissionOnProject as jest.Mock).mockResolvedValue(false);

      const result = await executeQuery(query, { planId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
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

      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      (Guidance.prototype.create as jest.Mock).mockResolvedValue({ id: 99 });
      (Guidance.findById as jest.Mock).mockResolvedValue(mockCreated);
      (markGuidanceGroupAsDirty as jest.Mock).mockResolvedValue(undefined);

      const vars = { input: { guidanceGroupId: 10, guidanceText: 'New guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.addGuidance.id).toEqual(99);
      expect(result.body.singleResult.data.addGuidance.guidanceText).toEqual('New guidance');
      expect(markGuidanceGroupAsDirty).toHaveBeenCalledWith(expect.any(Object), 10);
    });

    it('should return Forbidden when admin does not have permission', async () => {
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);

      const vars = { input: { guidanceGroupId: 10, guidanceText: 'New guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should return error when guidance creation fails', async () => {
      // Use a mockImplementation so the Guidance instance has a proper errors object
      // and addError correctly mutates it (auto-mock doesn't run the real constructor).
      const instanceErrors: Record<string, string> = {};
      const mockInstance = {
        guidanceGroupId: 10,
        guidanceText: 'New guidance',
        tagId: 2,
        errors: instanceErrors,
        addError: jest.fn().mockImplementation((field: string, msg: string) => {
          instanceErrors[field] = msg;
        }),
        create: jest.fn().mockResolvedValue({ id: null, errors: {} }),
      };

      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      (Guidance as unknown as jest.Mock).mockImplementationOnce(() => mockInstance);

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
        update: jest.fn().mockResolvedValue({ id: 5 }),
      };
      const mockUpdated = { id: 5, guidanceGroupId: 10, guidanceText: 'Updated guidance', tagId: 2 };

      (Guidance.findById as jest.Mock)
        .mockResolvedValueOnce(mockGuidance)
        .mockResolvedValueOnce(mockUpdated);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      (markGuidanceGroupAsDirty as jest.Mock).mockResolvedValue(undefined);

      const vars = { input: { guidanceId: 5, guidanceText: 'Updated guidance', tagId: 2 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateGuidance.id).toEqual(5);
      expect(result.body.singleResult.data.updateGuidance.guidanceText).toEqual('Updated guidance');
      expect(markGuidanceGroupAsDirty).toHaveBeenCalledWith(expect.any(Object), 10);
    });

    it('should return NotFound when guidance does not exist', async () => {
      (Guidance.findById as jest.Mock).mockResolvedValue(null);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);

      const vars = { input: { guidanceId: 999, guidanceText: 'Updated', tagId: 1 } };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Guidance not found');
    });

    it('should return Forbidden when admin does not have permission', async () => {
      const mockGuidance = { id: 5, guidanceGroupId: 10 };

      (Guidance.findById as jest.Mock).mockResolvedValue(mockGuidance);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);

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
      const mockGuidance = {
        id: 5,
        guidanceGroupId: 10,
        guidanceText: 'To be deleted',
        errors: {},
        hasErrors: () => false,
        delete: jest.fn(),
      };
      const mockDeleted = { id: 5, guidanceGroupId: 10, guidanceText: 'To be deleted' };

      (Guidance.findById as jest.Mock).mockResolvedValue(mockGuidance);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);
      mockGuidance.delete.mockResolvedValue(mockDeleted);
      (markGuidanceGroupAsDirty as jest.Mock).mockResolvedValue(undefined);

      const result = await executeQuery(query, { guidanceId: 5 }, adminToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.removeGuidance.id).toEqual(5);
      expect(markGuidanceGroupAsDirty).toHaveBeenCalledWith(expect.any(Object), 10);
    });

    it('should return NotFound when guidance does not exist', async () => {
      (Guidance.findById as jest.Mock).mockResolvedValue(null);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(true);

      const result = await executeQuery(query, { guidanceId: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Guidance not found');
    });

    it('should return Forbidden when admin does not have permission', async () => {
      const mockGuidance = { id: 5, guidanceGroupId: 10 };

      (Guidance.findById as jest.Mock).mockResolvedValue(mockGuidance);
      (hasPermissionOnGuidanceGroup as jest.Mock).mockResolvedValue(false);

      const result = await executeQuery(query, { guidanceId: 5 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });
});
