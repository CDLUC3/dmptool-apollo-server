/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

import { GraphQLError } from "graphql";
import { MyContext } from "../../context.js";

jest.unstable_mockModule('../../datasources/cache.js', () => ({
  Cache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  })),
}));

const mockFindByProjectId = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindByUserIdAndProjectId = jest.fn<(...args: any[]) => Promise<any>>();

const actualCollaborator = await import('../../models/Collaborator.js');
jest.unstable_mockModule('../../models/Collaborator.js', () => ({
  ...actualCollaborator,
  ProjectCollaborator: {
    findByProjectId: mockFindByProjectId,
    findByUserIdAndProjectId: mockFindByUserIdAndProjectId,
  },
  ProjectCollaboratorAccessLevel: {
    PRIMARY: 'PRIMARY',
    OWN: 'OWN',
    EDIT: 'EDIT',
    COMMENT: 'COMMENT',
  },
}));

const mockIsSuperAdmin = jest.fn<(...args: any[]) => boolean>();

const actualAuthService = await import('../authService.js');
jest.unstable_mockModule('../authService.js', () => {
  const mocked: Record<string, any> = {};
  for (const [key, value] of Object.entries(actualAuthService)) {
    mocked[key] = typeof value === 'function' ? jest.fn() : value;
  }
  return {
    ...mocked,
    isSuperAdmin: mockIsSuperAdmin,
  };
});

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { validateProjectCollaboratorAccessChange, demoteExistingPrimaryCollaborator } = await import('../collaboratorService.js');
const { ProjectCollaboratorAccessLevel } = await import('../../models/Collaborator.js');
const { isSuperAdmin, } = await import("../authService.js");


describe('collaboratorService', () => {
  let context: MyContext;
  const projectId = casual.integer(1, 1000);

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProjectCollaboratorAccessChange', () => {

    describe('when demoting the PRIMARY', () => {
      it('should throw a GraphQLError with LAST_PRIMARY_COLLABORATOR code', async () => {
        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.PRIMARY,
            ProjectCollaboratorAccessLevel.OWN,
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.PRIMARY,
            ProjectCollaboratorAccessLevel.OWN,
          )
        ).rejects.toMatchObject({
          extensions: { code: 'LAST_PRIMARY_COLLABORATOR' }
        });
      });
    });

    describe('when assigning PRIMARY as a SuperAdmin', () => {
      it('should resolve without throwing', async () => {
        mockIsSuperAdmin.mockReturnValue(true);

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.PRIMARY,
          )
        ).resolves.toBeUndefined();
      });
    });

    describe('when assigning PRIMARY as an existing PRIMARY collaborator', () => {
      it('should resolve without throwing', async () => {
        mockIsSuperAdmin.mockReturnValue(false);

        mockFindByUserIdAndProjectId.mockResolvedValue({
          accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
        });

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.PRIMARY,
          )
        ).resolves.toBeUndefined();
      });
    });

    describe('when assigning PRIMARY as a non-PRIMARY, non-SuperAdmin', () => {
      it('should throw a GraphQLError with FORBIDDEN code', async () => {
        (isSuperAdmin as jest.Mock).mockReturnValue(false);

        mockFindByUserIdAndProjectId.mockResolvedValue({
          accessLevel: ProjectCollaboratorAccessLevel.OWN,
        });

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.PRIMARY,
          )
        ).rejects.toMatchObject({
          extensions: { code: 'FORBIDDEN' }
        });
      });
    });

    describe('when making a non-PRIMARY access change', () => {
      it('should resolve without throwing', async () => {
        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.EDIT,
          )
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('demoteExistingPrimaryCollaborator', () => {
    const excludeCollaboratorId = casual.integer(1, 1000);

    describe('when an existing PRIMARY collaborator is found', () => {
      it('should demote them to OWN and call update', async () => {
        const mockUpdate = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const mockPrimary = {
          id: casual.integer(1, 1000),
          accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
          update: mockUpdate,
        };

        mockFindByProjectId.mockResolvedValue([mockPrimary]);

        await demoteExistingPrimaryCollaborator(context, projectId, excludeCollaboratorId);

        expect(mockPrimary.accessLevel).toBe(ProjectCollaboratorAccessLevel.OWN);
        expect(mockUpdate).toHaveBeenCalledWith(context);
      });
    });

    describe('when no PRIMARY collaborator exists', () => {
      it('should resolve without calling update', async () => {
        const mockUpdate = jest.fn<() => Promise<void>>();
        mockFindByProjectId.mockResolvedValue([
          { id: excludeCollaboratorId, accessLevel: ProjectCollaboratorAccessLevel.OWN, update: mockUpdate }
        ]);

        await expect(
          demoteExistingPrimaryCollaborator(context, projectId, excludeCollaboratorId)
        ).resolves.toBeUndefined();

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe('when the only PRIMARY is the excluded collaborator', () => {
      it('should not demote them', async () => {
        const mockUpdate = jest.fn<() => Promise<void>>();
        mockFindByProjectId.mockResolvedValue([
          { id: excludeCollaboratorId, accessLevel: ProjectCollaboratorAccessLevel.PRIMARY, update: mockUpdate }
        ]);

        await demoteExistingPrimaryCollaborator(context, projectId, excludeCollaboratorId);

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });
  });
});
